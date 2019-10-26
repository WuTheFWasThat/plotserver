## Installation

### Frontend

First install [`nvm`](https://github.com/nvm-sh/nvm#install-script).

Then `nvm install 8.12.0`.

Then `nvm use 8.12.0`.

Then `npm install`

### Backend

First install [`pipenv`](https://github.com/pypa/pipenv).

Then `pipenv install`

## Run

First, make sure you have the assets built (`npm run build`).
Then, usage is similar to tensorboard:

```
npm run serve -- --port $port --logs baseline:gs://logs/baseline/results/'*'/log.jsonl,new:gs://logs/new/results/'*'/log.jsonl
```

Currently, `jsonl` is the only supported format for logs

## Development

### Front-end development: `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

If you want to run against an actual server,
```
npm run serve -- --dev_mode
REACT_APP_SERVER_ADDRESS="http://localhost:6006" npm start
```

### `npm test` (currently broken)

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### Production build: `npm run build`

Builds the app for production to the `build` folder.<br />

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
