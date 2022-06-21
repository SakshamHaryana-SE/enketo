/**
 * Deals with communication to the server (in process of being transformed to using Promises)
 */

import encryptor from './encryptor';
import settings from './settings';
import { t } from './translator';
import utils from './utils';
import {
    getLastSavedRecord,
    LAST_SAVED_VIRTUAL_ENDPOINT,
    populateLastSavedInstances,
    setLastSavedRecord,
} from './last-saved';
import { AbsenceReason, AffiliationType, Batch, Districts, IndustryName, ITINames, TradeNames } from "./traineeData"

const bc = new BroadcastChannel('test_channel');

/**
 * @typedef {import('../../../../app/models/record-model').EnketoRecord} EnketoRecord
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyObject} Survey
 */

/**
 * @typedef {import('../../../../app/models/survey-model').SurveyExternalData} SurveyExternalData
 */

/**
 * @typedef BatchPrepped
 * @property { string } instanceId
 * @property { string } deprecatedId
 * @property { FormData } formData
 * @property { string[] } failedFiles
 */

/**
 * @typedef UploadRecordOptions
 * @property { boolean } [isLastSaved]
 */

/**
 * @typedef UploadBatchResult
 * @property { number } status
 * @property { Array<string | undefined> } failedFiles
 * @property { string } [message]
 */

/**
 * @typedef GetFormPartsProps
 * @property { string } enketoId
 * @property { Record<string, string> } [defaults]
 * @property { string } [instanceId]
 * @property { string } [xformUrl]
 */

const parser = new DOMParser();
const xmlSerializer = new XMLSerializer();
const CONNECTION_URL = `${settings.basePath}/connection`;
const TRANSFORM_URL = `${settings.basePath}/transform/xform${settings.enketoId ? `/${settings.enketoId}` : ''}`;
const TRANSFORM_HASH_URL = `${settings.basePath}/transform/xform/hash/${settings.enketoId}`;
const INSTANCE_URL = (settings.enketoId) ? `${settings.basePath}/submission/${settings.enketoId}` : null;
const MAX_SIZE_URL = (settings.enketoId) ? `${settings.basePath}/submission/max-size/${settings.enketoId}` :
    `${settings.basePath}/submission/max-size/?xformUrl=${encodeURIComponent(settings.xformUrl)}`;
const ABSOLUTE_MAX_SIZE = 100 * 1000 * 1000;
const HASURA_URL = settings.hasuraEndPoint;
const HASURA_ADMIN_SECRET = settings.hasuraAdminSecret;
const FLASK_URL = settings.flaskUrl;
const HEADERS = {
    'Authorization': `Bearer ${HASURA_ADMIN_SECRET}`,
    'Content-Type': 'application/json',
}
const API_URL = settings.apiUrl;
const HTTP_BASIC_USER = settings.httpBasicUser;
const HTTP_BASIC_PASS = settings.httpBasicPass;
const MINIO = {
    LOGIN_ID: settings.loginId,
    MINIO_PASSWORD: settings.minioPassword,
    APPLICATION_ID: settings.applicationId,
    HEADER_AUTH_TOKEN: settings.headerAuthToken,
    BUCKET_ID: settings.bucketId,
    LOGIN_URL: settings.loginApi,
    HOST: settings.host
}
const ENKETO_END_POINT = settings.enketoEndPoint


/**
 /**
 * Checks online status
 */
function getOnlineStatus() {
    return fetch(CONNECTION_URL, { cache: 'no-cache', headers: { 'Content-Type': 'text/plain' } })
        .then(response => {
            return response.text();
        })
        // It is important to check for the content of the no-cache response as it will
        // start receiving the fallback page served by the service worker when offline!
        .then(text => /connected/.test(text))
        .catch(() => false);
}

const getLoginToken = () => {
    // return "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkY5NEl0dktKT0RlQXlabVRCX2NlX1J3ejVsMCJ9.eyJhdWQiOiIyMDExYTZjOS03ZmI3LTQzMDYtOGM2ZC1jOTZjYjA3Yzc4NTkiLCJleHAiOjE2NTQ2OTA0NzksImlhdCI6MTY1NDY4Njg3OSwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyZjZjYjA1OC1mZjYzLTRjMmUtOGQyNC1jOTg5YWIyNjY0OTciLCJqdGkiOiJkZTAyODNhOS03N2IyLTRjOWQtOGNhYS1hNTdiYmUwNDUxNjUiLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6InBkZi1tYWtlLWNkbiIsImFwcGxpY2F0aW9uSWQiOiIyMDExYTZjOS03ZmI3LTQzMDYtOGM2ZC1jOTZjYjA3Yzc4NTkiLCJyb2xlcyI6WyJwZGYtbWFrZSJdLCJwb2xpY3kiOiJwZGYtbWFrZSJ9.NhVYaRzO9rPrAIEaEhFCKuJcUDxtkFA12PfDaqray3pCWtfmyqrkWXQ3MRjLTagcNmN1_Ohhb52vl1mMBYy6ddsQBfC0bzufPqdzjqsK0JE0skwuPzS8gOdwKlR2PTHk5PuXU-thfu4YUDk71kOYpP5Dmd-B9D-Cexyq28dQzxAdC6thdH6rWTZ3TJVaj2MDKJBy24d93DQxdHm4f_29ccRr-qGPNI-PP8s8BexDOx8Hr8t0kFnpVU2i1TF8cr1I2tlMtajxr-EvWhmAdX4JPtF_H6soIzug6wYNOSowopEQgw7WSJ5ywllTfHjRgILlA4_fz0tlDT9GnjTB-XPmTg";
    try {
        let logToken;

        let postData = {
            loginId: MINIO.LOGIN_ID,
            password: MINIO.MINIO_PASSWORD,
            applicationId: MINIO.APPLICATION_ID,
        };

        let header = {
            'content-type': 'application/json',
            Authorization: MINIO.HEADER_AUTH_TOKEN,
        };

        return fetch(MINIO.LOGIN_URL, {
            method: 'POST',
            cache: 'no-cache',
            headers: header,
            body: JSON.stringify(postData)
        })
            .then(async (res) => {
                const resData = await res.json();
                logToken = resData.token;

                return logToken;
            }).catch((err) => {
                throw { message: `Login Token error: ${err}` };
            });

    } catch (err) {
        console.log('Error', err);
        throw err;
    }
};

const getSessionToken = async (logToken) => {
    let accesskey;
    let secretkey;
    let sessionToken;


    try {
        let bucketId = MINIO.BUCKET_ID;
        console.log(`https://${MINIO.HOST}/minio/${bucketId}/?Action=AssumeRoleWithWebIdentity&DurationSeconds=36000&WebIdentityToken=${logToken}&Version=2011-06-15`);
        return fetch(`https://${MINIO.HOST}/minio/${bucketId}/?Action=AssumeRoleWithWebIdentity&DurationSeconds=36000&WebIdentityToken=${logToken}&Version=2011-06-15`, {
            method: 'POST',
            cache: 'no-cache'
        })
            .then(async (res) => {
                const resData = await res.text()
                let parser = new DOMParser();
                let doc = parser.parseFromString(resData, 'text/xml');
                console.log(doc);
                accesskey = doc.getElementsByTagName("AccessKeyId")[0].textContent;
                secretkey = doc.getElementsByTagName("SecretAccessKey")[0].textContent;
                sessionToken = doc.getElementsByTagName("SessionToken")[0].textContent;

                return {
                    accessKey: accesskey,
                    secretKey: secretkey,
                    sessionToken: sessionToken,
                };
            }).catch((err) => {
                throw { message: `Session Token error: ${err}` };
            });
    } catch (err) {
        console.log(err);
        throw err;
    }
};


/**
 * Uploads a complete record
 *
 * @param  { EnketoRecord } record
 * @return { Promise<UploadBatchResult> }
 */
async function _uploadRecord(record) {
    let batches;

    try {
        batches = _prepareFormDataArray(record);
    } catch (e) {
        return Promise.reject(e);
    }
    // Get form data
    let formData = {};
    let parser = new DOMParser();
    let doc = parser.parseFromString(record.xml, 'text/xml');
    let formId = doc.getElementById('DST-Attendance-1');
    if (formId !== null) {
        let enrl = doc.getElementsByTagName("reg_no");
        let dob = doc.getElementsByTagName("dob");
        formData.registrationNumber = enrl[0].textContent
        formData.dob = dob[0].textContent
    }

    // Add aatendance
    // Get form data
    let attendanceDetail = {
        attendanceStatus: false,
        absenceReason: ''
    };
    let locationDetail = true;
    let selfieURL = "";
    let traineeDetailStatus = false;
    let parserString = new DOMParser();
    let document = parserString.parseFromString(record.xml, 'text/xml');
    let attendanceFormId = document.getElementById('DST-Attendance');
    let traineeRegistration = document.getElementById('trainee_registration');
    if (attendanceFormId !== null) {
        let detailsStatus = doc.getElementsByTagName("details");
        if (detailsStatus.length !== 0) {
            if (detailsStatus[0].textContent === 'No') {
                traineeDetailStatus = false
                // Redirect to React with a location
                console.log("CP-0");
                traineeId = localStorage.getItem("traineeId");
                const traineeDetails = await fetch(`${HASURA_URL}/api/rest/trainee/byId?id=${traineeId}`, { headers: HEADERS }).then(res => res.json());
                const trainee = traineeDetails.trainee[0];
                const findKeyByValue = (object, valueToFind, defaultValue) => {
                    for (const [key, value] of Object.entries(object)) {
                        if (valueToFind === value) return key;
                    }
                    return defaultValue;
                }
                console.log("test");

                const url = [
                    `${FLASK_URL}/prefill/traineeRegistration?`,
                    `reg_id=${trainee.registrationNumber}`,
                    `&trainee_name=${trainee.name}`,
                    `&trainee_phone_number=${trainee.phone}`,
                    `&trainee_gender=${trainee.gender}`,
                    `&trainee_dob=${trainee.DOB}`,
                    `&trainee_father_name=${trainee.father}`,
                    `&trainee_mother_name=${trainee.mother}`,
                    `&trainee_affiliation=${trainee.affiliationType === 'NCVT' ? 1 : 2}`,
                    `&district_name=${findKeyByValue(Districts, trainee.itiByIti.district, null)}`,
                    `&iti_name=${findKeyByValue(ITINames, trainee.itiByIti.name, null)}`,
                    `&batch=2022-2023`,
                    `&trade_name=${findKeyByValue(ITINames, trainee.tradeName, null)}`,
                    `&statusFlag=2`,
                    `&industry_name=${findKeyByValue(IndustryName, trainee.industryByIndustry.name, null)}`
                ].join("");

                const message = JSON.stringify({
                    message: traineeId,
                    url: url, //Additional Param added
                    loginRes: trainee,
                    date: Date.now(),
                    channel: 'traineeDetail'
                });
                window.parent.postMessage(message, '*');
                return;
            } else {
                traineeDetailStatus = true
            }
        }
        let location = doc.getElementsByTagName("distance");
        if (location.length !== 0) {
            if (location[0].textContent > 500) {
                locationDetail = false;
            } else {
                locationDetail = true;
            }
        }
        const findKeyByValue = (object, valueToFind, defaultValue) => {
            for (const [key, value] of Object.entries(object)) {
                if (valueToFind === key) return value;
            }
            return defaultValue;
        }

        let attendance = doc.getElementsByTagName("attendance_status");
        let absence_reason = doc.getElementsByTagName("absence_rsn");
        if (attendance.length !== 0) {
            if (attendance[0].textContent === 'Present') {
                attendanceDetail.attendanceStatus = true;
            } else {
                if (absence_reason[0].textContent === 6) {
                    attendanceDetail.absenceReason = doc.getElementsByTagName("if_other");
                } else {
                    attendanceDetail.absenceReason = `${findKeyByValue(AbsenceReason, absence_reason[0].textContent, null)}`
                }
                attendanceDetail.selfie = '';
                attendanceDetail.attendanceStatus = false;
            }
        }

        let selfie = window.document.getElementsByName('/data/selfie/selfie');
        if (attendance[0].textContent === 'Present' && location.length !== 0) {
            const imgBase64 = selfie[0].dataset.resizedDataURI;
            const postData = { image: imgBase64 };

            selfieURL = await fetch(`${ENKETO_END_POINT}/submission/minio-file-upload`, {
                method: 'POST',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData)
            }).then(response => response.json());

            attendanceDetail.selfie = selfieURL.data;

            console.log('----', selfieURL);
        }
    }

    // Get Trainee Data
    let trainerData = {};
    let traineeData = {};
    let domParser = new DOMParser();
    let parseDoc = domParser.parseFromString(record.xml, 'text/xml');
    let trainerFormId = parseDoc.getElementById('trainer_login_beta_launch');
    if (trainerFormId !== null) {
        const findKeyByValue = (object, valueToFind, defaultValue) => {
            for (const [key, value] of Object.entries(object)) {
                if (valueToFind === key) return value;
            }
            return defaultValue;
        }

        let trainerName = parseDoc.getElementsByTagName("trainer_name");
        let trainerPhoneNumber = parseDoc.getElementsByTagName("trainer_phone_number");
        let districtName = parseDoc.getElementsByTagName("district_name");
        let itiName = parseDoc.getElementsByTagName("iti_name");
        let batch = parseDoc.getElementsByTagName("batch");
        let tradeName = parseDoc.getElementsByTagName("trade_name");
        let industryName = parseDoc.getElementsByTagName("industry_name");
        let locationConfirm = parseDoc.getElementsByTagName("location_confirm");
        let recordLocation = parseDoc.getElementsByTagName("record_location");
        let location = recordLocation[0].textContent.split(' ');

        trainerData.trainer_name = trainerName[0].textContent
        trainerData.trainer_phone_number = trainerPhoneNumber[0].textContent
        trainerData.district_name = `${findKeyByValue(Districts, districtName[0].textContent, null)}`
        trainerData.iti_name = `${findKeyByValue(ITINames, itiName[0].textContent, null)}`
        trainerData.batch = `${findKeyByValue(Batch, batch[0].textContent, null)}`
        trainerData.trade_name = `${findKeyByValue(TradeNames, tradeName[0].textContent, null)}`
        trainerData.industry_name = `${findKeyByValue(IndustryName, industryName[0].textContent, null)}`
        trainerData.location_confirm = locationConfirm[0].textContent
        trainerData.lat = location[0]
        trainerData.lng = location[1]
    } else if (traineeRegistration !== null) {
        // <trainee_name/>
        // <trainee_phone_number/>
        // <trainee_gender/>
        // <trainee_dob/>
        // <trainee_father_name/>
        // <trainee_mother_name/>
        // <trainee_affiliation/>
        // <district_name/>
        // <iti_name/>
        // <batch/>
        // <trade_name/>
        // <industry_name/>
        domParser = new DOMParser();
        parseDoc = domParser.parseFromString(record.xml, 'text/xml');
        const itiName = ITINames[parseDoc.getElementsByTagName("iti_name")[0].textContent];
        const industryName = IndustryName[parseDoc.getElementsByTagName("industry_name")[0].textContent];
        const regId = parseDoc.getElementsByTagName("reg_id")[0].textContent;
        const itiDetails = await fetch(`${HASURA_URL}/api/rest/iti?name=${itiName}`, { headers: HEADERS }).then(res => res.json());
        const industryDetails = await fetch(`${HASURA_URL}/api/rest/getIndustryByName?name=${industryName}`, { headers: HEADERS }).then(res => res.json());
        const isTraineePresentInDB = await fetch(`${HASURA_URL}/api/rest/trainee/id?reg=${regId}`, { headers: HEADERS }).then(res => res.json());
        traineeData = {
            "industry": industryDetails.industry[0].id,
            "iti": itiDetails.iti[0].id,
            "DOB": parseDoc.getElementsByTagName("trainee_dob")[0].textContent,
            "affiliationType": AffiliationType[parseDoc.getElementsByTagName("trainee_affiliation")[0].textContent],
            "batch": Batch[parseDoc.getElementsByTagName("batch")[0].textContent],
            "phone": parseDoc.getElementsByTagName("trainee_phone_number")[0].textContent,
            "father": parseDoc.getElementsByTagName("trainee_father_name")[0].textContent,
            "mother": parseDoc.getElementsByTagName("trainee_mother_name")[0].textContent,
            "name": parseDoc.getElementsByTagName("trainee_name")[0].textContent,
            "tradeName": TradeNames[parseDoc.getElementsByTagName("trade_name")[0].textContent],
            "gender": parseDoc.getElementsByTagName("trainee_gender")[0].textContent,
            // "dateOfAdmission": parseDoc.getElementsByTagName("trainee_affiliation"),
            "registrationNumber": regId,
            "statusFlag": isTraineePresentInDB.trainee.length > 0 ? 1 : 2,
        }
        console.log('traineeData', traineeData);

    } else { }


    /** @type { Promise<UploadBatchResult[]> } */
    let resultsPromise = Promise.resolve([]);

    /** @type { UploadBatchResult } */
    let result;

    // Perform batch uploads sequentially for to avoid issues when connections are very poor and
    // a serious issue with ODK Aggregate (https://github.com/kobotoolbox/enketo-express/issues/400)
    return batches.reduce((prevPromise, batch) => {
        return prevPromise.then(results => {
            return _uploadBatch(batch, formData, attendanceDetail, traineeDetailStatus, locationDetail, trainerData, traineeData).then(result => {
                results.push(result);

                return results;
            });
        });
    }, resultsPromise)
        .then(results => {
            console.log('results of all batches submitted', results);

            result = results[0];
        })
        .then(() => result);
}

const uploadQueuedRecord = _uploadRecord;

const uploadRecord = (survey, record) => (
    setLastSavedRecord(survey, record)
        .then(() => _uploadRecord(record))
);

/**
 * Uploads a single batch of a single record.
 *
 * @param { BatchPrepped } recordBatch - formData object to send
 * @return { Promise<UploadBatchResult> }      [description]
 */

// CONVERT OBJECT TO QUERY STRING
function queryString(obj) {
    const str = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const p in obj) {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(p)) {
            str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
        }
    }
    return str.join('&');
};

async function _uploadBatch(recordBatch, formData, attendanceDetail, traineeDetailStatus, locationDetail, trainerData, traineeData) {
    // Submission URL is dynamic, because settings.submissionParameter only gets populated after loading form from
    // cache in offline mode.
    // const xmlResponse = parser.parseFromString(form.getDataStr( include ), 'text/xml' );
    const submissionUrl = `${HASURA_URL}/api/rest/getTraineeByEnrlAndDob`
    const controller = new AbortController();

    function getMeta(metaName) {
        return document.querySelector(`meta[name=${metaName}]`).content;
    }
    const submissionId = getMeta("formId");

    setTimeout(() => {
        controller.abort();
    }, settings.timeout);

    if (submissionId === "enrollment") {
        return fetch(submissionUrl, {
            method: 'POST',
            cache: 'no-cache',
            headers: HEADERS,
            signal: controller.signal,
            body: JSON.stringify(formData)
        })
            .then(async response => {

                const resData = await response.json();
                /** @type { UploadBatchResult } */
                let result = {
                    status: response.status,
                    failedFiles: (recordBatch.failedFiles) ? recordBatch.failedFiles : undefined,
                    isValid: resData.trainee.length > 0
                };
                if (resData.trainee.length > 0) {
                    traineeData = resData.trainee[0];
                    // Call login or register api for trainee
                    const traineeParams = {
                        id: formData.registrationNumber,
                        dob: formData.dob
                    }
                    const traineeId = resData.trainee[0].id;
                    const traineeDetails = await fetch(`${HASURA_URL}/api/rest/trainee/byId?id=${traineeId}`, { headers: HEADERS }).then(res => res.json());
                    const trainee = traineeDetails.trainee[0];
                    const message = JSON.stringify({
                        message: resData.trainee[0],
                        loginRes: trainee,
                        date: Date.now(),
                        channel: 'enketo'
                    });
                    result.isTraineeLogin = true;
                    localStorage.setItem("industryId", resData.trainee[0].industry);
                    localStorage.setItem("traineeId", resData.trainee[0].id);
                    window.parent.postMessage(message, '*');
                    // const traineeLoginUrl = `${API_URL}/dst/trainee/loginOrRegister?${await queryString(traineeParams)}`;
                    // const traineeLoginRes = await fetch(traineeLoginUrl, {
                    //     method: 'GET',
                    //     cache: 'no-cache',
                    //     headers:  {
                    //         'Authorization':`Basic ${window.btoa(unescape(encodeURIComponent( `${HTTP_BASIC_USER}:${HTTP_BASIC_PASS}` )))}`,
                    //         'Content-Type':'application/json',
                    //     },
                    // });
                    // const responseOfTrainee = await traineeLoginRes.json();
                    // const { resp: { params: { status, errMsg } } } = responseOfTrainee;
                    // if (status === 'Success') {
                    //     const message = JSON.stringify({
                    //         message: resData.trainee[0],
                    //         loginRes: responseOfTrainee,
                    //         date: Date.now(),
                    //         channel: 'enketo'
                    //     });
                    //     result.isTraineeLogin = true;
                    //     localStorage.setItem("industryId", resData.trainee[0].industry);
                    //     localStorage.setItem("traineeId", resData.trainee[0].id);
                    //     window.parent.postMessage(message, '*');
                    // } else {
                    //     result.isTraineeLogin = false;
                    //     result.errorMsg = errMsg;
                    // }
                }


                if (response.status === 400 || resData.trainee.length === 0) {
                    // 400 is a generic error. Any message returned by the server is probably more useful.
                    // Other more specific statusCodes will get hardcoded and translated messages.
                    const message = JSON.stringify({
                        message: null,
                        url: null, //Additional Param added
                        loginRes: null,
                        date: Date.now(),
                        channel: 'traineeAfterLoginDetail'
                    });
                    window.parent.postMessage(message, '*');
                    return;
                    // return response.text()
                    //     .then( text => {
                    //         const xmlResponse = parser.parseFromString( text, 'text/xml' );
                    //         if ( xmlResponse ){
                    //             const messageEl = xmlResponse.querySelector( 'OpenRosaResponse > message' );
                    //             if ( messageEl ) {
                    //                 result.message = messageEl.textContent;
                    //             }
                    //         }
                    //         throw result;
                    //     } );
                } else if (response.status !== 201 && response.status !== 202) {
                    return result;
                } else {
                    return result;
                }
            })
            .catch(error => {
                if (error.name === 'AbortError' && typeof error.status === 'undefined') {
                    error.status = 408;
                }
                throw error;
            });
    } else if (submissionId === "preFilled") {
        const prefilledSubmissionId = getMeta("formId");
        // Get current month & year
        const d = new Date();
        const currentMonthYearData = {
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            industry_id: parseInt(localStorage.getItem("industryId"))
        }
        const attendanceApiUrl = `${HASURA_URL}/api/rest/getIndustryScheduleByMonthAndYear`
        return fetch(attendanceApiUrl, {
            method: 'POST',
            cache: 'no-cache',
            headers: HEADERS,
            signal: controller.signal,
            body: JSON.stringify(currentMonthYearData)
        })
            .then(async response => {
                const resData = await response.json();

                /** @type { UploadBatchResult } */
                let result = {
                    status: response.status,
                    failedFiles: (recordBatch.failedFiles) ? recordBatch.failedFiles : undefined,
                    isIndustry: resData.schedule.length !== 0 ? resData.schedule[0].is_industry : false,
                    prefilledSubmissionId,
                    traineeDetailStatus,
                    locationDetail
                };

                // Attendance submit
                if (result.isIndustry && prefilledSubmissionId === 'preFilled' && traineeDetailStatus && locationDetail) {
                    // Attendance submit
                    var today = new Date();
                    var attendanceDate = (today.getMonth() + 1) + '-' + today.getDate() + '-' + today.getFullYear();
                    const attendanceData = {
                        industry_id: parseInt(localStorage.getItem("industryId")),
                        trainee_id: parseInt(localStorage.getItem("traineeId")),
                        date: attendanceDate,
                        is_present: attendanceDetail.attendanceStatus,
                        absence_reason: attendanceDetail.absenceReason,
                        selfie: attendanceDetail.selfie
                    }
                    const attendanceUrl = `${HASURA_URL}/api/rest/addAttendance`
                    const attendanceRes = await fetch(attendanceUrl, {
                        method: 'POST',
                        cache: 'no-cache',
                        headers: HEADERS,
                        signal: controller.signal,
                        body: JSON.stringify(attendanceData)
                    });
                    const attendanceResponse = await attendanceRes.json();
                    result.isAttendanceSubmit = (attendanceResponse.hasOwnProperty('code') && attendanceResponse.code === "constraint-violation" || attendanceResponse.code === "validation-failed")
                }

                if (response.status === 400) {
                    // 400 is a generic error. Any message returned by the server is probably more useful.
                    // Other more specific statusCodes will get hardcoded and translated messages.
                    return response.text()
                        .then(text => {
                            const xmlResponse = parser.parseFromString(text, 'text/xml');
                            if (xmlResponse) {
                                const messageEl = xmlResponse.querySelector('OpenRosaResponse > message');
                                if (messageEl) {
                                    result.message = messageEl.textContent;
                                }
                            }
                            throw result;
                        });
                } else if (response.status !== 201 && response.status !== 202) {
                    return result;
                } else {
                    return result;
                }
            })
            .catch(error => {
                if (error.name === 'AbortError' && typeof error.status === 'undefined') {
                    error.status = 408;
                }
                throw error;
            });
    } else if (submissionId === "trainer") {
        const addTrainerUrl = `${HASURA_URL}/api/rest/addTrainer`;
        console.log('addTrainerUrl', addTrainerUrl)
        console.log('trainerData', trainerData)
        return fetch(addTrainerUrl, {
            method: 'POST',
            cache: 'no-cache',
            headers: HEADERS,
            signal: controller.signal,
            body: JSON.stringify(trainerData)
        })
            .then(async response => {

                const resData = await response.json();
                console.log('res data', resData);
                /** @type { UploadBatchResult } */
                let result = {
                    status: response.status,
                    failedFiles: (recordBatch.failedFiles) ? recordBatch.failedFiles : undefined,
                };

                if (response.status === 400) {
                    // 400 is a generic error. Any message returned by the server is probably more useful.
                    // Other more specific statusCodes will get hardcoded and translated messages.
                    return response.text()
                        .then(text => {
                            const xmlResponse = parser.parseFromString(text, 'text/xml');
                            if (xmlResponse) {
                                const messageEl = xmlResponse.querySelector('OpenRosaResponse > message');
                                if (messageEl) {
                                    result.message = messageEl.textContent;
                                }
                            }
                            throw result;
                        });
                } else if (response.status !== 201 && response.status !== 202) {
                    return result;
                } else {
                    return result;
                }
            })
            .catch(error => {
                if (error.name === 'AbortError' && typeof error.status === 'undefined') {
                    error.status = 408;
                }
                throw error;
            });
    } if (submissionId === "traineeRegistration") {
        const upsertTrainee = `${HASURA_URL}/api/rest/trainee`;
        return fetch(`${upsertTrainee}`, {
            method: 'POST',
            cache: 'no-cache',
            headers: HEADERS,
            signal: controller.signal,
            body: JSON.stringify({ trainee: traineeData })
        })
            .then(async response => {

                const resData = await response.json();
                console.log('res data trainee data', resData);
                /** @type { UploadBatchResult } */
                let result = {
                    status: response.status,
                    failedFiles: (recordBatch.failedFiles) ? recordBatch.failedFiles : undefined,
                };

                if (response.status === 400) {
                    // 400 is a generic error. Any message returned by the server is probably more useful.
                    // Other more specific statusCodes will get hardcoded and translated messages.
                    return response.text()
                        .then(text => {
                            const xmlResponse = parser.parseFromString(text, 'text/xml');
                            if (xmlResponse) {
                                const messageEl = xmlResponse.querySelector('OpenRosaResponse > message');
                                if (messageEl) {
                                    result.message = messageEl.textContent;
                                }
                            }
                            throw result;
                        });
                } else if (response.status === 200) {
                    // Add Hook to verify if registered correctly
                    const traineeParams = {
                        id: formData.registrationNumber,
                        dob: formData.dob
                    }
                    const traineeId = resData.insert_trainee_one.id;
                    const traineeDetails = await fetch(`${HASURA_URL}/api/rest/trainee/byId?id=${traineeId}`, { headers: HEADERS }).then(res => res.json());
                    const trainee = traineeDetails.trainee[0];
                    const message = JSON.stringify({
                        traineeId: resData.insert_trainee_one.id,
                        user: trainee,
                        isRegistered: true,
                        date: Date.now(),
                        channel: 'traineeRegistration'
                    });
                     localStorage.setItem("industryId", traineeDetails.trainee[0].industry);
                     localStorage.setItem("traineeId", traineeDetails.trainee[0].id);
                    window.parent.postMessage(message, '*');
                    return;
                } else {
                    const message = JSON.stringify({
                        traineeId: null,
                        loginRes: trainee,
                        isRegistered: false,
                        date: Date.now(),
                        channel: 'traineeRegistration'
                    });
                    window.parent.postMessage(message, '*');
                }
            })
            .catch(error => {
                if (error.name === 'AbortError' && typeof error.status === 'undefined') {
                    error.status = 408;
                }
                throw error;
            });
    }
}

/**
 * Builds up a record array including media files, divided into batches
 *
 * @param { EnketoRecord } record - record object
 * @return { BatchPrepped[] }
 */
function _prepareFormDataArray(record) {
    const recordDoc = parser.parseFromString(record.xml, 'text/xml');

    /** @type {Array<Omit<HTMLInputElement, 'type'>>} */
    const fileElements = Array.prototype.slice.call(recordDoc.querySelectorAll('[type="file"]')).map(el => {
        el.removeAttribute('type');

        return el;
    });
    const xmlData = xmlSerializer.serializeToString(recordDoc.documentElement);
    const xmlSubmissionBlob = new Blob([xmlData], {
        type: 'text/xml'
    });
    const availableFiles = record.files || [];
    const sizes = [];

    /** @type {string[]} */
    let failedFiles = [];

    const submissionFiles = [];
    let batches = [
        []
    ];

    /** @type {BatchPrepped[]} */
    let batchesPrepped = [];

    const maxSize = settings.maxSize;

    fileElements.forEach(el => {
        let file;
        const nodeName = el.nodeName;
        const fileName = el.textContent;

        // check if file is actually available
        availableFiles.some(f => {
            if (f.name === fileName) {
                file = f;

                return true;
            }

            return false;
        });

        // add the file if it is available
        if (file) {
            submissionFiles.push({
                nodeName,
                file
            });
            sizes.push(file.size);
        } else {
            failedFiles.push(fileName);
            console.error(`Error occured when trying to retrieve ${fileName}`);
        }
    });

    if (submissionFiles.length > 0) {
        batches = _divideIntoBatches(sizes, maxSize);
    }
    console.log(`splitting record into ${batches.length} batches to reduce submission size `, batches);

    batches.forEach(batch => {
        const fd = new FormData();

        fd.append('xml_submission_file', xmlSubmissionBlob, 'xml_submission_file');
        const csrfToken = (document.cookie.split('; ').find(c => c.startsWith('__csrf')) || '').split('=')[1];
        if (csrfToken) fd.append('__csrf', csrfToken);

        // batch with XML data
        let batchPrepped = {
            instanceId: record.instanceId,
            deprecatedId: record.deprecatedId,
            formData: fd,
            failedFiles
        };

        // add any media files to the batch
        batch.forEach(fileIndex => {
            // Not clear what name is appropriate. Since file.name is unique and works, this is used.
            batchPrepped.formData.append(submissionFiles[fileIndex].file.name, submissionFiles[fileIndex].file, submissionFiles[fileIndex].file.name);
        });

        // push the batch to the array
        batchesPrepped.push(batchPrepped);
    });

    return batchesPrepped;
}


/**
 * splits an array of file sizes into batches (for submission) based on a limit
 *
 * @param  {Array.<number>} fileSizes -   array of file sizes
 * @param  {number}     limit -   limit in byte size of one chunk (can be exceeded for a single item)
 * @return {Array.<Array.<number>>} array of arrays with index, each secondary array of indices represents a batch
 */

function _divideIntoBatches(fileSizes, limit) {
    let i;
    let j;
    let batch;
    let batchSize;
    const sizes = [];
    const batches = [];

    for (i = 0; i < fileSizes.length; i++) {
        sizes.push({
            'index': i,
            'size': fileSizes[i]
        });
    }

    while (sizes.length > 0) {
        batch = [sizes[0].index];
        batchSize = sizes[0].size;
        if (sizes[0].size < limit) {
            for (i = 1; i < sizes.length; i++) {
                if ((batchSize + sizes[i].size) < limit) {
                    batch.push(sizes[i].index);
                    batchSize += sizes[i].size;
                }
            }
        }
        batches.push(batch);
        for (i = 0; i < sizes.length; i++) {
            for (j = 0; j < batch.length; j++) {
                if (sizes[i].index === batch[j]) {
                    sizes.splice(i, 1);
                }
            }
        }
    }

    return batches;
}


/**
 * Returns the value of the X-OpenRosa-Content-Length header returned by the OpenRosa server for this form.
 *
 * @param {object} survey - survey object
 * @return { Promise } a Promise that resolves with the provided survey object with added maxSize property if successful
 */
function getMaximumSubmissionSize(survey) {
    // TODO: add 5 sec timeout?
    return fetch(MAX_SIZE_URL)
        .then(response => response.json())
        .then(data => {
            if (data && data.maxSize && !isNaN(data.maxSize)) {
                survey.maxSize = Number(data.maxSize) > ABSOLUTE_MAX_SIZE ? ABSOLUTE_MAX_SIZE : Number(data.maxSize);
            } else {
                console.error('Error retrieving maximum submission size. Unexpected response: ', data);
            }
        })
        .catch(() => { })
        .then(() => survey);
}

/**
 * Obtains HTML Form, XML Model and External Instances
 *
 * @param { GetFormPartsProps } props - form properties object
 * @return { Promise<Survey> } a Promise that resolves with a form parts object
 */
function getFormParts(props) {
    /** @type {Survey} */
    let survey;

    return _postData(TRANSFORM_URL + _getQuery(), {
        xformUrl: props.xformUrl
    })
        .then(data => {
            const model = parser.parseFromString(data.model, 'text/xml');

            const encryptedSubmission = model.querySelector('submission[base64RsaPublicKey]');

            survey = Object.assign({}, data, {
                enketoId: props.enketoId,
                theme: data.theme || utils.getThemeFromFormStr(data.form) || settings.defaultTheme,
            });

            if (encryptedSubmission != null) {
                survey = encryptor.setEncryptionEnabled(survey);
            }

            const relativeBinaryDefaults = model.querySelectorAll('instance > * > *[src^="/"]');

            relativeBinaryDefaults.forEach(element => {
                const src = element.getAttribute('src');

                element.setAttribute('src', new URL(src, window.location));
            });

            survey.model = xmlSerializer.serializeToString(model.documentElement);

            return _getExternalData(survey, model);
        })
        .then(externalData => Object.assign(survey, { externalData }))
        .then(survey => Promise.all([
            survey,
            getLastSavedRecord(survey.enketoId),
        ]))
        .then(([survey, lastSavedRecord]) => (
            populateLastSavedInstances(survey, lastSavedRecord)
        ));
}

function _postData(url, data = {}) {
    return _request(url, 'POST', data);
}

function _getData(url, data = {}) {
    return _request(url, 'GET', data);
}

function _request(url, method = 'POST', data = {}) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }
    };
    // add data
    if (method === 'GET' || method === 'HEAD') {
        if (Object.keys(data).length) {
            const urlObj = new URL(url, location.href);
            const search = urlObj.search.slice(1);
            urlObj.search = `?${search}${search ? '&' : ''}${_encodeFormData(data)}`;
            url = urlObj.href;
        }
    } else {
        options.body = _encodeFormData(data);
    }

    return fetch(url, options)
        .then(_throwResponseError)
        .then(response => response.json())
        .catch(data => {
            const error = new Error(data.message);
            error.status = data.status;
            throw error;
        });
}

/**
 * @param { Response } response
 * @return { Response }
 */
function _throwResponseError(response) {
    if (!response.ok) {
        return response.json()
            .then(data => {
                if (typeof data.status === 'undefined') {
                    data.status = response.status;
                }
                if (typeof data.message === 'undefined') {
                    data.status = response.statusText;
                }
                throw data;
            });
    } else {
        return response;
    }
}

function _encodeFormData(data) {
    return Object.keys(data)
        .filter(key => data[key])
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
        .join('&');
}

/**
 * @param {Survey} survey
 * @param {Document} model
 * @return {Promise<SurveyExternalData[]>}
 */
function _getExternalData(survey, model) {
    /** @type {Array<Promise<SurveyExternalData>>} */
    let tasks = [];

    try {
        const externalInstances = [...model.querySelectorAll('instance[id][src]')]
            .map(instance => ({
                id: instance.id,
                src: instance.getAttribute('src')
            }));

        externalInstances
            .forEach((instance, index) => {
                if (instance.src === LAST_SAVED_VIRTUAL_ENDPOINT) {
                    tasks.push(Promise.resolve(instance));

                    return;
                }

                tasks.push(_getDataFile(instance.src, survey.languageMap)
                    .then(xmlData => {
                        return Object.assign({}, instance, { xml: xmlData });
                    })
                    .catch(e => {
                        tasks.splice(index, 1);
                        // let external data files fail quietly in previews with ?form= parameter
                        if (!survey.enketoId) {
                            return;
                        }
                        throw e;
                    }));
            });
    } catch (e) {
        return Promise.reject(e);
    }

    return Promise.all(tasks);
}


/**
 * Obtains a media file
 *
 * @param { string } url - a URL to a media file
 * @return {Promise<{url: string, item: Blob}>} a Promise that resolves with a media file object
 */
function getMediaFile(url) {

    return fetch(url)
        .then(_throwResponseError)
        .then(response => response.blob())
        .then(item => ({ url, item }))
        .catch(data => {
            const error = new Error(data.message || t('error.loadfailed', {
                resource: url,
                // switch off escaping just for this known safe value
                interpolation: {
                    escapeValue: false
                }
            }));
            error.status = data.status;
            throw error;
        });
}

/**
 * Obtains a data/text file
 *
 * @param { string } url - URL to data tile
 * @param {object } languageMap - language map object with language name properties and IANA subtag values
 * @return {Promise<XMLDocument>} a Promise that resolves with an XML Document
 */
function _getDataFile(url, languageMap) {
    let contentType;

    return fetch(url)
        .then(response => {
            contentType = response.headers.get('Content-Type').split(';')[0];

            return response.text();
        })
        .then(responseText => {
            let result;
            switch (contentType) {
                case 'text/csv':
                    result = utils.csvToXml(responseText, languageMap);
                    break;
                case 'text/xml':
                    result = parser.parseFromString(responseText, contentType);
                    break;
                default:
                    console.error('External data not served with expected Content-Type.', contentType);
                    result = parser.parseFromString(responseText, 'text/xml');
            }
            if (result && result.querySelector('parsererror') && contentType !== 'text/csv') {
                console.log('Failed to parse external data as XML, am going to try as CSV');
                result = utils.csvToXml(responseText, languageMap);
            }

            return result;
        })
        .catch(error => {
            const errorMsg = error.message || t('error.dataloadfailed', {
                url,
                // switch off escaping just for this known safe value
                interpolation: {
                    escapeValue: false
                }
            });
            throw new Error(errorMsg);
        });
}

/**
 * Extracts version from service worker script
 *
 * @param { string } serviceWorkerUrl - service worker URL
 * @return {Promise<string>} a Promise that resolves with the version of the service worker or 'unknown'
 */
function getServiceWorkerVersion(serviceWorkerUrl) {

    return fetch(serviceWorkerUrl)
        .then(response => {
            return response.text();
        })
        .then(text => {
            const matches = text.match(/version\s?=\s?'([^\n]+)'/);

            return matches ? matches[1] : 'unknown';
        });
}

function getFormPartsHash() {
    return _postData(TRANSFORM_HASH_URL + _getQuery())
        .then(data => data.hash);
}

/**
 * Obtains XML instance that is cached at the server
 *
 * @param { object } props - form properties object
 * @return { Promise<string> } a Promise that resolves with an XML instance as text
 */
function getExistingInstance(props) {
    return _getData(INSTANCE_URL, props);
}

// Note: settings.submissionParameter is only populated after loading form from cache in offline mode.
function _getQuery() {
    return utils.getQueryString([settings.languageOverrideParameter, settings.submissionParameter]);
}

export default {
    uploadRecord,
    uploadQueuedRecord,
    getMaximumSubmissionSize,
    getOnlineStatus,
    getFormParts,
    getFormPartsHash,
    getMediaFile,
    getExistingInstance,
    getServiceWorkerVersion,
};
