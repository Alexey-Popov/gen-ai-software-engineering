# How to Run

> Scaffold only. Commands to be filled in once the sample app and pipeline runner are implemented.

## Prerequisites
- Node.js >= 20
- npm

## Install
```bash
cd homework-4
npm install
```

## Run the sample application
```bash
npm start
```

## Run tests
```bash
npm test
```

## Run the 4-agent pipeline (single command)
```bash
npm run pipeline
# or
./run-pipeline.sh
```

The pipeline starts agents in order:
Research Verifier → Bug Fixer → Security Verifier → Unit Test Generator
and produces artifacts under `context/bugs/001/`.
