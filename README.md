# comesa-tests
Repo for COMESA tests

## COMESA Environment setup
 ![COMESA Environment](./COMESA-Environment.png)

## Structure of the tests
The tests are structured in the following way:
### 1. scheme_rule_tests

#### 1.1. zmw_as_payer_tests
    - These tests are run using TTK UI for test-zmw-dfsp
    - The tests cover the following scenarios:
        - `Payer` is `ZMW` and `Payee` is `MWK` : To test ZMW Outgoing amount
        - `Payer` is `ZMW` and `Payee` is `MWK` : To test MWK Incoming amount

#### 1.2. mwk_as_payer_tests
    - These tests are run using TTK UI for test-mwk-dfsp
    - The tests cover the following scenarios:
        - `Payer` is `MWK` and `Payee` is `ZMW` : To test MWK Outgoing amount
        - `Payer` is `MWK` and `Payee` is `ZMW` : To test ZMW Incoming amount

### 2. comesa_golden_path