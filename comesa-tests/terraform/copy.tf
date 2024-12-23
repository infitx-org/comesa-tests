resource "local_file" "ttk-files" {
    for_each = fileset(dirname(path.module), "{collections,environments}/**")
    content  = file("${dirname(path.module)}/${each.value}")
    filename = "${var.outputDir}/comesa-tests/environments/${each.value}"
}

variable "outputDir" {
  type = string
}
