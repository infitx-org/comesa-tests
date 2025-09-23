# GP Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying GP (tests, rules, and environment files) to target environments.

## 1. Tests
  - 1.1 Merge the feature branch into main branch of commas-tests repo
  - 1.2 Create a new release 
  - 1.3 Update the release comesa-iac-addons repo at https://github.com/infitx-org/comesa-iac-addons/blob/main/default.yaml#L23

## 2. Rules
  - 2.1 Update https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config/pm4ml-values-override.yaml to point to the release that was created in step 1.2 above
  - 2.2 While testing the rules in DEV environment, this line can be pointed to a branch. This is only for testing purposes and should be a short-lived task. This is not applicable for higher environments.
   - 2.3 Once the rules are updated in the main branch, delete the ttk-backend pod in the correspoing pm4ml test dfsp to pick up the new rules.
## 3. Env files
  - 3.1 Update https://github.com/infitx-org/comesa-iac-addons/blob/main/comesaTests/values-ttk-default.yaml
## 4. Scheme Rule updates
  - 4.1 Update the rules for the corresponding scheme in the main branch and commit. Using zm-dev as an example here https://gitlab.ccdev.drpp-onprem.global/iac/zm-dev/-/blob/main/custom-config/mojaloop-values-override.yaml?ref_type=heads
## 5. Deployment
  - 5.1 Run refresh-deploy-infra gitlab job
## 6. Validation
  - 6.1 To validate that the rules are deployed into corresponding pm4mls, check the scheme specific pm4ml UI validation rules section, not the rules section for Super TTK.
