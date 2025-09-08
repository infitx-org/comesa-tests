# Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying tests, rules, and environment files to the target environment.

## Prerequisites
- Access to GitHub repositories:
  - `commas-tests` repository
  - `comesa-iac-addons` repository (https://github.com/infitx-org/comesa-iac-addons)
- Access to GitLab:
  - `iac/pm-dev/custom-config` project (https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config)
- Appropriate permissions to:
  - Merge branches
  - Create releases
  - Update configuration files
  - Trigger GitLab CI/CD pipelines

## 1. Tests Deployment

### 1.1 Merge Feature Branch
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

### 1.2 Create New Release
```bash
# Create and push a new tag for the release
git tag -a v<version> -m "Release v<version>"
git push origin v<version>

# Or create release via GitHub CLI if available
gh release create v<version> --title "Release v<version>" --notes "Release notes here"
```

### 1.3 Update comesa-iac-addons Repository
**File to update:** `https://github.com/infitx-org/comesa-iac-addons/blob/main/default.yaml`
**Line:** 23

```bash
# Clone or navigate to comesa-iac-addons repository
git clone https://github.com/infitx-org/comesa-iac-addons.git
cd comesa-iac-addons

# Edit default.yaml at line 23
# Update the release version reference to the new release created in step 1.2
```

**Manual step:** Update line 23 in `default.yaml` to reference the new release version.

### 1.4 Run GitLab Deploy Job
⚠️ **Action Required:** More information needed about:
- Which GitLab project contains the deploy job
- Job name or pipeline trigger method
- Required parameters or variables

**Placeholder command:**
```bash
# Example using GitLab CI/CD API or CLI
# This needs to be updated with actual project details
curl -X POST \
  --form token=<pipeline_token> \
  --form ref=main \
  https://gitlab.ccdev.drpp-onprem.global/api/v4/projects/<project_id>/trigger/pipeline
```

## 2. Rules Deployment

### 2.1 Update pm4ml-values-override.yaml
**File to update:** `https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config/pm4ml-values-override.yaml`

**Important:** The URL must be a raw GitHub user URL format.

```bash
# Clone the GitLab repository
git clone https://gitlab.ccdev.drpp-onprem.global/iac/pm-dev/custom-config.git
cd custom-config

# Edit pm4ml-values-override.yaml
# Update the rules location to point to raw GitHub URL
# Format: https://raw.githubusercontent.com/<org>/<repo>/<branch>/<path-to-rules>
```

**Example raw GitHub URL format:**
```
https://raw.githubusercontent.com/infitx-org/your-repo/main/path/to/rules.yaml
```

### 2.2 Commit and Push Changes
```bash
# Add and commit the changes
git add pm4ml-values-override.yaml
git commit -m "Update rules location to new raw GitHub URL"
git push origin main
```

### 2.3 Run GitLab Deploy Job
⚠️ **Action Required:** More information needed about:
- Specific job name for rules deployment
- Pipeline trigger method
- Required parameters

## 3. Environment Files Deployment

### 3.1 Update values-ttk-default.yaml
**File to update:** `https://github.com/infitx-org/comesa-iac-addons/blob/main/comesaTests/values-ttk-default.yaml`

```bash
# Navigate to comesa-iac-addons repository (if not already there)
cd /path/to/comesa-iac-addons

# Edit the values file
# Update configuration as needed
```

### 3.2 Commit and Push Changes
```bash
# Add and commit the changes
git add comesaTests/values-ttk-default.yaml
git commit -m "Update TTK default values configuration"
git push origin main
```

### 3.3 Run GitLab Deploy Job
⚠️ **Action Required:** More information needed about:
- Deploy job for environment files
- Pipeline configuration
- Trigger method

## Verification Steps

After each deployment phase:

1. **Verify GitHub repository updates:**
   ```bash
   # Check that commits are properly pushed
   git log --oneline -5
   ```

2. **Verify GitLab pipeline status:**
   - Check pipeline status in GitLab UI
   - Monitor deployment logs
   - Verify successful completion

3. **Test deployed components:**
   - Run smoke tests if available
   - Verify service health endpoints
   - Check application logs

## Rollback Procedures

### Tests Rollback
```bash
# Revert to previous release
git revert <commit-hash>
git push origin main

# Or checkout previous release tag
git checkout v<previous-version>
git checkout -b hotfix/rollback
git push origin hotfix/rollback
```

### Rules/Config Rollback
```bash
# Navigate to config repository
cd /path/to/custom-config

# Revert changes
git revert <commit-hash>
git push origin main
```

## Information Needed

To complete this runbook, please provide:

1. **GitLab Deploy Jobs:**
   - Project ID or full project path for each deploy job
   - Job names or pipeline trigger methods
   - Required environment variables or parameters
   - Authentication method (tokens, API keys)

2. **Specific Configuration Values:**
   - Exact format for rules URL in pm4ml-values-override.yaml
   - Required fields in values-ttk-default.yaml
   - Version numbering scheme for releases

3. **Access Credentials:**
   - How to obtain GitLab pipeline tokens
   - Required permissions for each step

## Contacts

- **Release Engineering Team:** [Contact Information]
- **DevOps Team:** [Contact Information]
- **On-call Support:** [Contact Information]

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-09-08 | 1.0 | Initial runbook creation | Release Engineer |

---

**Note:** This runbook should be reviewed and updated as deployment processes evolve. Please ensure all placeholder information is filled in before use in production.
