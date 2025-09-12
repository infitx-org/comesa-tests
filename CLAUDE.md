# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a COMESA (Common Market for Eastern and Southern Africa) testing framework (v1.7.0) that runs automated tests for cross-border payment systems using the Mojaloop Testing Toolkit (TTK). The project tests multi-scheme transactions between different DFSPs (Digital Financial Service Providers) with various currencies like ZMW, MWK, UGX, etc.

## Development Commands

- **Start the service**: `npm run start` or `npm run start:service` - Starts the main Bull queue dashboard and test orchestration service at http://localhost:3000
- **Run single test**: `npm run start:testRun` - Executes a single test run without the UI
- **No tests defined**: The project doesn't have unit tests - testing is done via TTK integration

## Architecture Overview

### Core Components

- **FlowExecutor** (`src/flowExecutor.js`) - Main orchestrator that manages test execution queues using BullMQ
- **Bull Dashboard** (`src/index.js`) - Express web interface for monitoring test queues at port 3000
- **Test Runner** (`src/testRun.js`) - CLI interface for executing test runs
- **Processors** (`src/processors/`) - Queue workers that handle different test types:
  - `ttkTestsProcessor.js` - Executes TTK test collections 
  - `reportGenerationProcessor.js` - Generates Allure reports
  - `sampleProcessor.js` - Sample processor template

### Test Structure

The project is organized around TTK (Testing Toolkit) patterns:

- **Test Collections** (`ttk-test-collection/`):
  - `multi-scheme-tests/` - Cross-currency transfer tests including:
    - `parties_test_cases.json` - Party existence and DFSP migration tests
    - `fxtransfers_transfers_test_cases.json` - FX transfer test scenarios
    - `scheme_tests.json` - Scheme-level test configurations
  - `per-scheme-tests/` - Single currency provisioning tests
  - `static-tests/` - Static test samples
  
- **Environments** (`ttk-environments/`) - TTK environment configurations for different DFSP combinations, including development environments like `multi_test-mwk-to_test-zmw-DEV.json`

- **Rules** (`ttk-rules/`) - TTK response and callback rules for test validation

- **Configuration** (`config/testConfig.json`) - Main config defining DFSPs, currencies, and test amounts

### Queue System

The system uses BullMQ with Redis for job processing:
- `waitBullMq` - Top-level coordination queue
- `staticTestsBullMq` - Static/sample tests
- `perSchemeTestsBullMq` - Per-scheme provisioning tests  
- `multiSchemeTestsBullMq` - Multi-scheme transfer tests
- `reportGenerationBullMq` - Report generation tasks

## Key Configuration

### DFSP Configuration
DFSPs are defined in `config/testConfig.json` with properties:
- `name` - DFSP identifier
- `enabled` - Whether to include in tests
- `currency` - Base currency (ZMW, MWK, UGX)
- `endpoint` - Role in transactions (payer/payee)
- `happyPathMSISDN` - Test phone number

### Multi-Scheme Testing
Cross-currency tests are configured with:
- Source DFSP and send amount
- Target DFSPs with expected receive amounts
- Exchange rates are implied by amount ratios

### Party Testing Scenarios
The framework includes comprehensive party validation tests:
- **DRPP-GP-04**: Party does not exist in any scheme (Error code 3204)
- **DRPP-GP-05**: Party exists in multiple schemes under different currencies
- **DRPP-GP-06**: Party migration between DFSPs within a single scheme
- **DRPP-GP-08**: DFSP processing error scenarios (Error code 4200)

## Dependencies

- **@mojaloop/ml-testing-toolkit-client-lib** - TTK client for test execution
- **bullmq** & **@bull-board** - Queue management and monitoring
- **allure-commandline** - Test reporting
- **axios** - HTTP client
- **@slack/webhook** - Slack notifications

## Development Notes

- Tests are executed against external TTK instances, not unit tests
- Redis is required for queue management (default localhost:6379)
- Docker Compose setup available for TTK services
- Allure reports are generated in `./reports/allure_reports/`
- Web UI provides queue monitoring and manual test triggering