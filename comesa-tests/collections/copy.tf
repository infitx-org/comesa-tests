resource "local_file" "ttk-files" {
    for_each = fileset(path.module, "**")
    content  = file("${path.module}/${each.value}")
    filename = "${var.outputDir}/comesa-tests/collections/${each.value}"
}

variable "outputDir" {
  type = string
}
