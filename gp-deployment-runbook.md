# GP Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying GP (tests, rules, and environment files) to target environments.

## Prerequisites
- Access to GitHub repositories:
  - `commas-tests` repository
  - `comesa-iac-addons` repository (https://github.com/infitx-org/comesa-iac-addons)
- Access to GitLab:
  - `iac/pm-dev/custom-config` project (https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config)
  - Access to run `refresh-deploy-infra` GitLab job
- Appropriate permissions to:
  - Merge branches
  - Create releases
  - Update configuration files
  - Trigger GitLab CI/CD pipelines
- Access to scheme-specific PM4ML UI for validation

## Deployment Steps

### 1. Tests Deployment

#### 1.1 Merge Feature Branch
```bash
# Navigate to commas-tests repository
cd /path/to/commas-tests

# Switch to main branch and pull latest changes
git checkout main
git pull origin main

# Merge the feature branch into main
git merge <feature-branch-name>

# Push the merged changes
git push origin main
```

#### 1.2 Create New Release
```bash
# Create and push a new tag for the release
git tag -a v<version> -m "Release v<version>"
git push origin v<version>

# Or create release via GitHub CLI if available
gh release create v<version> --title "Release v<version>" --notes "Release notes here"
```

**Important:** Note the release version/tag created - this will be needed for step 2.1.

#### 1.3 Update comesa-iac-addons Repository
**File to update:** `https://github.com/infitx-org/comesa-iac-addons/blob/main/default.yaml`
**Line:** 23

```bash
# Clone or navigate to comesa-iac-addons repository
git clone https://github.com/infitx-org/comesa-iac-addons.git
cd comesa-iac-addons

# Pull latest changes
git checkout main
git pull origin main

# Edit default.yaml at line 23
# Update the release version reference to the new release created in step 1.2
```

**Manual step:** Update line 23 in `default.yaml` to reference the new release version.

```bash
# Commit and push the changes
git add default.yaml
git commit -m "Update release version to v<version>"
git push origin main
```

### 2. Rules Deployment

#### 2.1 Update pm4ml-values-override.yaml
**File to update:** `https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config/pm4ml-values-override.yaml`

**Important:** Point this to the release that was created in step 1.2.

```bash
# Clone the GitLab repository
git clone https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config.git
cd custom-config

# Pull latest changes
git checkout main
git pull origin main

# Edit pm4ml-values-override.yaml
# Update the rules location to point to the release created in step 1.2
# Format: https://raw.githubusercontent.com/infitx-org/commas-tests/v<version>/path/to/rules
```

**For DEV Environment Testing Only:**
- While testing rules in DEV environment, this line can be pointed to a branch instead of a release
- This is only for testing purposes and should be a short-lived task
- This is **NOT applicable** for higher environments (staging, production)
- Example branch format: `https://raw.githubusercontent.com/infitx-org/commas-tests/<branch-name>/path/to/rules`

```bash
# Commit and push the changes
git add pm4ml-values-override.yaml
git commit -m "Update rules location to release v<version>"
git push origin main
```

### 3. Environment Files Deployment

#### 3.1 Update values-ttk-default.yaml
**File to update:** `https://github.com/infitx-org/comesa-iac-addons/blob/main/comesaTests/values-ttk-default.yaml`

```bash
# Navigate to comesa-iac-addons repository (if not already there)
cd /path/to/comesa-iac-addons

# Pull latest changes
git checkout main
git pull origin main

# Edit the values file
# Update configuration as needed for the environment
```

```bash
# Commit and push the changes
git add comesaTests/values-ttk-default.yaml
git commit -m "Update TTK default values configuration"
git push origin main
```

### 4. Deploy Infrastructure

#### 4.1 Run refresh-deploy-infra GitLab Job
After completing all the above configuration updates, trigger the deployment:

```bash
# Using GitLab CLI (if available)
# Replace <project-id> with actual project ID
glab ci run --project-id=<project-id> --ref=main --job=refresh-deploy-infra

# Or using curl with GitLab API
curl -X POST \
  --form token=<pipeline_token> \
  --form ref=main \
  --form variables[JOB_NAME]=refresh-deploy-infra \
  https://gitlab.ccdev.drpp-onprem.global/api/v4/projects/<project_id>/trigger/pipeline
```

**Manual Alternative:** Navigate to the GitLab project in the web UI and manually trigger the `refresh-deploy-infra` job.

### 5. Validation

#### 5.1 Validate Rules Deployment
**Important:** To validate that the rules are deployed into corresponding PM4MLs:

1. **Access scheme-specific PM4ML UI**
2. **Navigate to the validation rules section** (NOT the rules section for Super TTK)
3. **Verify the new rules are present and active**

```bash
# Example validation steps
# 1. Open browser to scheme-specific PM4ML UI
# 2. Login with appropriate credentials
# 3. Navigate to: Settings > Validation Rules (or similar path)
# 4. Confirm new rules from release v<version> are loaded
# 5. Test a sample transaction to verify rules are working
```

## Verification Checklist

After deployment, verify the following:

- [ ] **GitHub repositories updated:**
  - [ ] Feature branch merged to main in commas-tests
  - [ ] New release created and tagged
  - [ ] default.yaml updated with new release version
  - [ ] values-ttk-default.yaml updated with environment configuration

- [ ] **GitLab configuration updated:**
  - [ ] pm4ml-values-override.yaml points to correct release (not branch for prod)

- [ ] **Infrastructure deployment:**
  - [ ] refresh-deploy-infra job completed successfully
  - [ ] No errors in deployment logs

- [ ] **Rules validation:**
  - [ ] Rules visible in scheme-specific PM4ML UI validation rules section
  - [ ] Sample transaction processed with new rules

## Rollback Procedures

### Quick Rollback
If issues are discovered after deployment:

```bash
# 1. Revert comesa-iac-addons changes
cd /path/to/comesa-iac-addons
git revert <commit-hash>
git push origin main

# 2. Revert GitLab config changes
cd /path/to/custom-config
git revert <commit-hash>
git push origin main

# 3. Re-run refresh-deploy-infra job to deploy reverted configuration
```

### Full Rollback to Previous Release
```bash
# 1. Update default.yaml to previous release
cd /path/to/comesa-iac-addons
# Edit default.yaml line 23 to previous release version
git add default.yaml
git commit -m "Rollback to previous release v<previous-version>"
git push origin main

# 2. Update pm4ml-values-override.yaml to previous release
cd /path/to/custom-config
# Edit pm4ml-values-override.yaml to point to previous release
git add pm4ml-values-override.yaml
git commit -m "Rollback rules to previous release v<previous-version>"
git push origin main

# 3. Re-run refresh-deploy-infra job
```

## Environment-Specific Notes

### DEV Environment
- Can temporarily point rules to branches for testing
- Use branch references in pm4ml-values-override.yaml only for short-lived testing
- Always revert to release references before promoting to higher environments

### Higher Environments (Staging, Production)
- **Always** use release versions, never branch references
- Follow full change management procedures
- Ensure thorough testing in DEV before promotion

## Troubleshooting

### Common Issues

1. **refresh-deploy-infra job fails:**
   - Check GitLab job logs for specific errors
   - Verify all configuration files are valid YAML
   - Ensure all referenced releases/versions exist

2. **Rules not appearing in PM4ML UI:**
   - Verify correct scheme-specific PM4ML UI is being checked
   - Check validation rules section, not general rules section
   - Allow time for configuration propagation

3. **Permission errors:**
   - Verify GitLab access tokens are valid
   - Check GitHub repository permissions
   - Confirm user has deployment privileges

## Contacts

- **Release Engineering Team:** [Contact Information]
- **DevOps Team:** [Contact Information]
- **PM4ML Support:** [Contact Information]
- **On-call Support:** [Contact Information]

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-09-09 | 2.0 | Updated with revised GP deployment instructions | Release Engineer |
| 2025-09-08 | 1.0 | Initial runbook creation | Release Engineer |

---

**Note:** This runbook should be reviewed and updated as deployment processes evolve. Always verify the latest procedures with the DevOps team before executing in production environments.
