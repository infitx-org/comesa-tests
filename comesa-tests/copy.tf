resource "local_file" "ttk-files" {
    for_each = fileset(path.module, "{collections,environments}/**")
    content  = file("${path.module}/${each.value}")
    filename = "${var.outputDir}/comesa-tests/${each.value}"
}

variable "outputDir" {
  type = string
}
