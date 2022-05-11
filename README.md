<p align="center">
  <h1>Enketo - ODK Backend</h1>
</p>

## About :open_book:

Enketo has been used all around the world for a wide range of uses from needs assessments in humanitarian aid, to raising historical awareness, to clinical research, to election monitoring.

## Features :dart:

- [x] Can connect to your custom backend
- [ ] Have the edit api in case user wants to edit submitted response
- [ ] Api for the customize change in XML of form
- [x] Have beautiful themes and widgets
- [x] Are printer-friendly
- [x] Can use very powerful skip and validation logic
- [x] Run on any device, mobile or desktop, as long as it has a fairly modern browser

## Use Case :rocket:

![Screencast from 03-02-22 05_31_50 PM IST](https://user-images.githubusercontent.com/56133783/152341126-ac03baa3-258c-473a-956a-d0973682234a.gif)

## Requirements :scroll:

1. Your machine should have [Yarn](https://classic.yarnpkg.com/en/docs/install/#windows-stable) or [Npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Docker](https://docs.docker.com/get-docker/), [Python](https://www.python.org/downloads/) installed.

_Note: Preferable Npm version (6.14.15) and Node version(v14.18.1)_

2. Check the node and npm version by running following commands.

```sh
node -v
npm -v
```

## Installation Steps :walking:

### 1. Fork it :fork_and_knife:

You can get your own fork/copy of [enketo](https://github.com/Samagra-Development/enketo) by using the <kbd><b>Fork</b></kbd> button.

### 2. Clone it :busts_in_silhouette:

You need to clone (download) it to a local machine using

```sh
git clone https://github.com/Your_Username/enketo.git
```

> This makes a local copy of the repository in your machine.

Once you have cloned the `enketo` repository in GitHub, move to that folder first using the change directory command.

```sh
# This will change directory to a folder FOSSologyUI
cd enketo
```

Move to this folder for all other commands.

### 3. Set it up :arrow_up:

Run the following commands to see that _your local copy_ has a reference to _your forked remote repository_ in GitHub :octocat:

```sh
git remote -v
origin  https://github.com/Your_Username/enketo.git (fetch)
origin  https://github.com/Your_Username/enketo.git (push)
```

### 4. Run it :checkered_flag:

```sh
cd enketo-express
docker run --name enketo-redis-main -p 6379:6379 -d redis
docker run --name enketo-redis-cache -p 6380:6379 -d redis
npm install
npm i -g grunt
grunt develop
```

```sh
cd ../enketo-core
npm install
npm start
```

```sh
cd ../enketo-transformer
npm install
npm start
```

```sh
cd ../forms
python3 -m http.server
```

You can preview your form on http://localhost:8005/preview?xform=http://localhost:8080/getForm/SOE

### 5. For integrating your backend

Customize the [submission url](https://github.com/Samagra-Development/enketo/blob/main/enketo-express/public/js/src/module/connection.js#L150) with your hosted backend.

## Future Enhancements :rocket:

- [Encrypting query parameters on rendering the enketo form. ](https://github.com/Samagra-Development/enketo/issues/1)
- Writing a API for changing an XML form directly from it.
- add npm scripts for install

We are trying to an inversion of control here.

### For Get API

`curl --location --request GET 'http://localhost:3002/form/form2'`

### Form Prefill API

```sh
curl --location --request POST 'http://localhost:3002/prefill' \
--header 'Content-Type: application/json' \
--data-raw '{
    "prefillSpec": {
        "pf_name": "`${onFormSuccessData.name}`",
        "pf_iti": "`${onFormSuccessData.itiByIti.name}`",
        "pf_trade": "`${onFormSuccessData.tradeName}`",
        "pf_batch": "`${onFormSuccessData.batch}`",
        "pf_industry": "`${onFormSuccessData.industryByIndustry.name}`",
        "ojt_month": "`${onFormSuccessData.industryByIndustry.schedules[0].is_industry === true ? 1 : 0}`"
    },
    "onFormSuccessData": {
        "name": "DEVA",
        "batch": "2021-2023",
        "id": 8,
        "DOB": "2005-03-04",
        "affiliationType": "NCVT",
        "registrationNumber": "ICA211021569832",
        "tradeName": "Electrician",
        "iti": 7,
        "industry": 1,
        "itiByIti": {
            "id": 7,
            "name": "GITI Nagina"
        },
        "industryByIndustry": {
            "id": 1,
            "name": "Kaushal Bhawan",
            "latitude": 30.695753,
            "longitude": 76.872025,
            "schedules": [
                {
                    "is_industry": true
                }
            ]
        }
    },
    "form": "form2"
}'
```
