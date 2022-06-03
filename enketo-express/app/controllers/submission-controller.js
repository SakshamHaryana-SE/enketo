/**
 * @module submissions-controller
 */

const communicator = require( '../lib/communicator' );
const surveyModel = require( '../models/survey-model' );
const userModel = require( '../models/user-model' );
const instanceModel = require( '../models/instance-model' );
const submissionModel = require( '../models/submission-model' );
const utils = require( '../lib/utils' );
const request = require( 'request' );
const express = require( 'express' );
const router = express.Router();
const routerUtils = require( '../lib/router-utils' );
const Minio = require("minio");
var fs = require('fs');
const multer  = require('multer')
const {server: config} = require("../models/config-model");
// var debug = require( 'debug' )( 'submission-controller' );
const file = '/home/usr-lp-11/Work/Projectes/enketo/enketo-express/app/images/test/no-profile1.png'

module.exports = app => {
    app.use(express.static(`${__dirname}/images`));
    app.use( `${app.get( 'base path' )}/submission`, router );
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


router.param( 'enketo_id', routerUtils.enketoId );
router.param( 'encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle );
router.param( 'encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView );

router
    .all( '*', ( req, res, next ) => {
        res.set( 'Content-Type', 'application/json' );
        next();
    } )
    .get( '/max-size/:encrypted_enketo_id_single', maxSize )
    .get( '/max-size/:encrypted_enketo_id_view', maxSize )
    .get( '/max-size/:enketo_id?', maxSize )
    // .post('/multerUploadImage', upload.single('file'), multerUploadImage)
    .post('/uploadImage', uploadMinioImage)
    .get( '/:encrypted_enketo_id_view', getInstance )
    .get( '/:enketo_id', getInstance )
    .post( '/:encrypted_enketo_id_single', submit )
    .post( '/:enketo_id', submit )
    .all( '/*', ( req, res, next ) => {
        const error = new Error( 'Not allowed' );
        error.status = 405;
        next( error );
    } );

/**
 * Simply pipes well-formed request to the OpenRosa server and
 * copies the response received.
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function submit( req, res, next ) {
    let submissionUrl;
    const paramName = req.app.get( 'query parameter to pass to submission' );
    const paramValue = req.query[ paramName ];
    const query = paramValue ? `?${paramName}=${paramValue}` : '';
    const instanceId = req.headers[ 'x-openrosa-instance-id' ];
    const deprecatedId = req.headers[ 'x-openrosa-deprecated-id' ];
    const id = req.enketoId;

    surveyModel.get( id )
        .then( survey => {
            submissionUrl = communicator.getSubmissionUrl( survey.openRosaServer ) + query;
            const credentials = userModel.getCredentials( req );

            return communicator.getAuthHeader( submissionUrl, credentials );
        } )
        .then( authHeader => {
            // Note even though headers is part of these options, it does not overwrite the headers set on the client!
            const options = {
                method: 'POST',
                url: submissionUrl,
                headers: authHeader ? {
                    'Authorization': authHeader
                } : {},
                timeout: req.app.get( 'timeout' ) + 500
            };

            // The Date header is actually forbidden to set programmatically, but we do it anyway to comply with OpenRosa
            options.headers[ 'Date' ] = new Date().toUTCString();

            // pipe the request
            req.pipe( request( options ) )
                .on( 'response', orResponse => {
                    if ( orResponse.statusCode === 201 ) {
                        _logSubmission( id, instanceId, deprecatedId );
                    } else if ( orResponse.statusCode === 401 ) {
                        // replace the www-authenticate header to avoid browser built-in authentication dialog
                        orResponse.headers[ 'WWW-Authenticate' ] = `enketo${orResponse.headers[ 'WWW-Authenticate' ]}`;
                    }
                } )
                .on( 'error', error => {
                    if ( error && ( error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ) ) {
                        if ( error.connect === true ) {
                            error.status = 504;
                        } else {
                            error.status = 408;
                        }
                    }

                    next( error );
                } )
                .pipe( res );

        } )
        .catch( next );
}

/*function multerUploadImage(req, res, next) {
   console.log('reqqq multer upload image', req.file)
}*/

async function uploadMinioImage( req, res, next ) {
try {
    console.log('Call upload image');
    /*const app = express();
    app.post("/upload", upload.single('avatar'), (req, res) => {
        // Stuff to be added later
        console.log('req.file', req.file);
        return res.json({status: 'OK', uploaded: '100'});
    });*/

    const {accessKey, secretKey, sessionToken} = req.body;
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
    res.json( { url: imageResUrl } );
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
function maxSize( req, res, next ) {
    console.log('Call maxsize')
    if ( req.query.xformUrl ) {
        // Non-standard way of attempting to obtain max submission size from XForm url directly
        communicator.getMaxSize( {
            info: {
                downloadUrl: req.query.xformUrl
            }
        } )
            .then( maxSize => {
                res.json( { maxSize } );
            } )
            .catch( next );
    } else {
        surveyModel.get( req.enketoId )
            .then( survey => {
                survey.credentials = userModel.getCredentials( req );

                return survey;
            } )
            .then( communicator.getMaxSize )
            .then( maxSize => {
                res.json( { maxSize } );
            } )
            .catch( next );
    }
}

/**
 * Obtains cached instance (for editing)
 *
 * @param {module:api-controller~ExpressRequest} req - HTTP request
 * @param {module:api-controller~ExpressResponse} res - HTTP response
 * @param {Function} next - Express callback
 */
function getInstance( req, res, next ) {
    surveyModel.get( req.enketoId )
        .then( survey => {
            survey.instanceId = req.query.instanceId;
            instanceModel.get( survey )
                .then( survey => {
                    // check if found instance actually belongs to the form
                    if ( utils.getOpenRosaKey( survey ) === survey.openRosaKey ) {
                        // Change URLs of instanceAttachments to local URLs
                        Object.keys( survey.instanceAttachments ).forEach( key => survey.instanceAttachments[ key ] = utils.toLocalMediaUrl( survey.instanceAttachments[ key ] ) );

                        res.json( {
                            instance: survey.instance,
                            instanceAttachments: survey.instanceAttachments
                        } );
                    } else {
                        const error = new Error( 'Instance doesn\'t belong to this form' );
                        error.status = 400;
                        throw error;
                    }
                } ).catch( next );
        } )
        .catch( next );
}

/**
 * @param { string } id - Enketo ID of survey
 * @param { string } instanceId - instance ID of record
 * @param { string } deprecatedId - deprecated (previous) ID of record
 */
function _logSubmission( id, instanceId, deprecatedId ) {
    submissionModel.isNew( id, instanceId )
        .then( notRecorded => {
            if ( notRecorded ) {
                // increment number of submissions
                surveyModel.incrementSubmissions( id );
                // store/log instanceId
                submissionModel.add( id, instanceId, deprecatedId );
            }
        } )
        .catch( error => {
            console.error( error );
        } );
}
