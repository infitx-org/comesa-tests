inputs = {
  outputDir = get_env("GITOPS_BUILD_OUTPUT_DIR")
}

terraform {
  copy_terraform_lock_file = false
}
