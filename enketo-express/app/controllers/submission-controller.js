/**
 * @module submissions-controller
 */

const communicator = require('../lib/communicator');
const surveyModel = require('../models/survey-model');
const userModel = require('../models/user-model');
const instanceModel = require('../models/instance-model');
const submissionModel = require('../models/submission-model');
const utils = require('../lib/utils');
const request = require('request');
const express = require('express');
const router = express.Router();
const routerUtils = require('../lib/router-utils');
const Minio = require("minio");
var fs = require('fs');
const multer = require('multer')
const { server: config } = require("../models/config-model");
const xml2js = require('xml2js');
// var debug = require( 'debug' )( 'submission-controller' );
const file = '/home/usr-lp-11/Work/Projectes/enketo/enketo-express/app/images/test/no-profile1.png'

module.exports = app => {
    app.use(express.static(`${__dirname}/images`));
    app.use(`${app.get('base path')}/submission`, router);
};

const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        const ext = file.file.split('/')[1];
        console.log('extension', ext, file);
        const id = `902766d3-8c45-4e5a-84ac-33389e0f843e`;
        const filePath = `test/${id}${ext}`
        cb(null, filePath);
    },
});

const upload = multer({
    storage: multerStorage
});


router.param('enketo_id', routerUtils.enketoId);
router.param('encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle);
router.param('encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView);

router
    .all('*', (req, res, next) => {
        res.set('Content-Type', 'application/json');
        next();
    })
    .get('/max-size/:encrypted_enketo_id_single', maxSize)
    .get('/max-size/:encrypted_enketo_id_view', maxSize)
    .get('/max-size/:enketo_id?', maxSize)
    // .post('/multerUploadImage', upload.single('file'), multerUploadImage)
    .post('/uploadImage', uploadMinioImage)
    .get('/:encrypted_enketo_id_view', getInstance)
    .get('/:enketo_id', getInstance)
    .post('/:encrypted_enketo_id_single', submit)
    .post('/:enketo_id', submit)
    .post('/minio-file-upload', minioFileUpload)
    .all('/*', (req, res, next) => {
        const error = new Error('Not allowed');
        error.status = 405;
        next(error);
    });

/**
 * Simply pipes well-formed request to the OpenRosa server and
 * copies the response received.
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function submit(req, res, next) {
    let submissionUrl;
    const paramName = req.app.get('query parameter to pass to submission');
    const paramValue = req.query[paramName];
    const query = paramValue ? `?${paramName}=${paramValue}` : '';
    const instanceId = req.headers['x-openrosa-instance-id'];
    const deprecatedId = req.headers['x-openrosa-deprecated-id'];
    const id = req.enketoId;

    surveyModel.get(id)
        .then(survey => {
            submissionUrl = communicator.getSubmissionUrl(survey.openRosaServer) + query;
            const credentials = userModel.getCredentials(req);

            return communicator.getAuthHeader(submissionUrl, credentials);
        })
        .then(authHeader => {
            // Note even though headers is part of these options, it does not overwrite the headers set on the client!
            const options = {
                method: 'POST',
                url: submissionUrl,
                headers: authHeader ? {
                    'Authorization': authHeader
                } : {},
                timeout: req.app.get('timeout') + 500
            };

            // The Date header is actually forbidden to set programmatically, but we do it anyway to comply with OpenRosa
            options.headers['Date'] = new Date().toUTCString();

            // pipe the request
            req.pipe(request(options))
                .on('response', orResponse => {
                    if (orResponse.statusCode === 201) {
                        _logSubmission(id, instanceId, deprecatedId);
                    } else if (orResponse.statusCode === 401) {
                        // replace the www-authenticate header to avoid browser built-in authentication dialog
                        orResponse.headers['WWW-Authenticate'] = `enketo${orResponse.headers['WWW-Authenticate']}`;
                    }
                })
                .on('error', error => {
                    if (error && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET')) {
                        if (error.connect === true) {
                            error.status = 504;
                        } else {
                            error.status = 408;
                        }
                    }

                    next(error);
                })
                .pipe(res);

        })
        .catch(next);
}

/*function multerUploadImage(req, res, next) {
   console.log('reqqq multer upload image', req.file)
}*/
async function minioFileUpload(req, res, next) {
    try {

        const base64Data = req.body.image.replace(/^data:image\/png;base64,/, "");
        // const fileName = new Date().getTime();
        const fileName = 'out';
        const filePath = `public/images/${fileName}.png`;
        fs.writeFileSync(filePath, base64Data, 'base64');
        const tokenRes = await getLoginToken();
        // console.log('----', tokenRes)
        const sessionRes = await getSessionToken(tokenRes);
        // console.log('**************',sessionRes);

        const minioClient = new Minio.Client({
            endPoint: "cdn.samagra.io",
            useSSL: true,
            accessKey: sessionRes.accessKey,
            secretKey: sessionRes.secretKey,
            sessionToken: sessionRes.sessionToken,
        });

        const metaData = {
            "Content-Type": "png/image",
        };

        const imageResponse = await new Promise((resolve, reject) => {
            minioClient.fPutObject(
                config['minio']['bucket-id'],
                "test-image.png",
                filePath,
                metaData,
                function (err, objInfo) {
                  if (err) {
                    return reject(err);
                  }
                  console.log("Success", objInfo);
                  resolve(objInfo)
                }
            );
        });

        res.json({ status: 'success', data: imageResponse });
    } catch (err) {
        console.log('Error', err);
        throw err;
    }
} 

const getLoginToken = () => {
    try {
        let logToken;

        let postData = {
            loginId: config['minio']['login-id'],
            password: config['minio']['minio-password'],
            applicationId: config['minio']['application-id'],
        };

        let header = {
            'content-type': 'application/json',
            Authorization: config['minio']['header-auth-token'],
        };

        const options = {
            method: 'POST',
            url: config['minio']['login-api'],
            headers: header,
            json: postData
        };

        return new Promise((resolve, reject) => {
            request(options, function (error, response, body) {
                if (error || !body) {
                    return reject(error);
                }

                resolve(body.token);
            })
        })
    } catch (err) {
        console.log('Error', err);
        throw err;
    }
};

const getSessionToken = async (logToken) => {
    let accesskey;
    let secretkey;
    let sessionToken;
    const MINIO = {
        BUCKET_ID: config['minio']['bucket-id'],
        HOST: config['minio']['host']
    };

  
    try {
        let bucketId = MINIO.BUCKET_ID;
        const options = {
            method: 'POST',
            url: `https://${MINIO.HOST}/minio/${bucketId}/?Action=AssumeRoleWithWebIdentity&DurationSeconds=36000&WebIdentityToken=${logToken}&Version=2011-06-15`,
        };

        return new Promise((resolve, reject) => {
            request(options, async function (error, response, body) {
                if (error || !body) {
                    return reject(error);
                }
                let parser = new xml2js.Parser();
                let doc = await parser.parseStringPromise(body);
                
                if (doc && doc.AssumeRoleWithWebIdentityResponse && 
                    doc.AssumeRoleWithWebIdentityResponse.AssumeRoleWithWebIdentityResult && 
                    doc.AssumeRoleWithWebIdentityResponse.AssumeRoleWithWebIdentityResult.length && 
                    doc.AssumeRoleWithWebIdentityResponse.AssumeRoleWithWebIdentityResult[0].Credentials &&
                    doc.AssumeRoleWithWebIdentityResponse.AssumeRoleWithWebIdentityResult[0].Credentials.length) {
                        const creds = doc.AssumeRoleWithWebIdentityResponse.AssumeRoleWithWebIdentityResult[0].Credentials[0];
                        
                        return resolve({
                            accessKey: creds.AccessKeyId[0],
                            secretKey: creds.SecretAccessKey[0],
                            sessionToken: creds.SessionToken[0],
                        });
                }
                reject("Body error");
            })
        })

        /* return fetch( , {
            method: 'POST',
            cache: 'no-cache'
        } )
            .then( async (res) => {
                const resData = await res.text()
                let parser = new DOMParser();
                let doc = parser.parseFromString(resData, 'text/xml');
                console.log(doc); 
                accesskey = doc.getElementsByTagName("AccessKeyId")[0].textContent;
                secretkey =  doc.getElementsByTagName("SecretAccessKey")[0].textContent;
                sessionToken = doc.getElementsByTagName("SessionToken")[0].textContent;

                return {
                    accessKey: accesskey,
                    secretKey: secretkey,
                    sessionToken: sessionToken,
                };
            }).catch((err) => {
                throw { message: `Session Token error: ${err}` };
            }); */
    } catch (err) {
       console.log(err);
        throw err;
    }
};


async function uploadMinioImage(req, res, next) {
    try {
        console.log('Call upload image', req);
        /*const app = express();
        app.post("/upload", upload.single('avatar'), (req, res) => {
            // Stuff to be added later
            console.log('req.file', req.file);
            return res.json({status: 'OK', uploaded: '100'});
        });*/

        const { accessKey, secretKey, sessionToken } = req.body;
        let minioClient = new Minio.Client({
            endPoint: config['minio']['host'],
            port: 9000,
            useSSL: false,
            accessKey,
            secretKey,
            sessionToken,
        });
        console.log('minioClient', minioClient)
        let metaData = {
            'Content-Type': 'png/image',
        };
        let imageUrl = minioClient.presignedUrl(
            'GET',
            config['minio']['bucket-id'],
            'enketo',
            1000,
            {
                versionId: minioClient.fPutObject(
                    config['minio']['bucket-id'],
                    'enketo',
                    file,
                    metaData
                ).etag,
            }
        );
        const imageResUrl = await imageUrl;
        res.json({ url: imageResUrl });
    } catch (e) {
        console.log('error', e);
    }
}

/**
 * Get max submission size.
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function maxSize(req, res, next) {
    console.log('Call maxsize')
    if (req.query.xformUrl) {
        // Non-standard way of attempting to obtain max submission size from XForm url directly
        communicator.getMaxSize({
            info: {
                downloadUrl: req.query.xformUrl
            }
        })
            .then(maxSize => {
                res.json({ maxSize });
            })
            .catch(next);
    } else {
        surveyModel.get(req.enketoId)
            .then(survey => {
                survey.credentials = userModel.getCredentials(req);

                return survey;
            })
            .then(communicator.getMaxSize)
            .then(maxSize => {
                res.json({ maxSize });
            })
            .catch(next);
    }
}

/**
 * Obtains cached instance (for editing)
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getInstance(req, res, next) {
    surveyModel.get(req.enketoId)
        .then(survey => {
            survey.instanceId = req.query.instanceId;
            instanceModel.get(survey)
                .then(survey => {
                    // check if found instance actually belongs to the form
                    if (utils.getOpenRosaKey(survey) === survey.openRosaKey) {
                        // Change URLs of instanceAttachments to local URLs
                        Object.keys(survey.instanceAttachments).forEach(key => survey.instanceAttachments[key] = utils.toLocalMediaUrl(survey.instanceAttachments[key]));

                        res.json({
                            instance: survey.instance,
                            instanceAttachments: survey.instanceAttachments
                        });
                    } else {
                        const error = new Error('Instance doesn\'t belong to this form');
                        error.status = 400;
                        throw error;
                    }
                }).catch(next);
        })
        .catch(next);
}

/**
 * @param { string } id - Enketo ID of survey
 * @param { string } instanceId - instance ID of record
 * @param { string } deprecatedId - deprecated (previous) ID of record
 */
function _logSubmission(id, instanceId, deprecatedId) {
    submissionModel.isNew(id, instanceId)
        .then(notRecorded => {
            if (notRecorded) {
                // increment number of submissions
                surveyModel.incrementSubmissions(id);
                // store/log instanceId
                submissionModel.add(id, instanceId, deprecatedId);
            }
        })
        .catch(error => {
            console.error(error);
        });
}
