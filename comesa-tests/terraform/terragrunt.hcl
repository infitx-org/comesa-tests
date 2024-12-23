include "root" {
  path = find_in_parent_folders()
}

inputs = {
  outputDir = get_env("GITOPS_BUILD_OUTPUT_DIR")
}
