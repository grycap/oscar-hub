#!/bin/sh
set -eu
: "${INPUT_FILE_PATH:?OSCAR must set INPUT_FILE_PATH}"
: "${TMP_OUTPUT_DIR:?OSCAR must set TMP_OUTPUT_DIR}"
mkdir -p "$TMP_OUTPUT_DIR"
# The upstream image provides R/BgeeDB; OSCAR supplies the analysis script.
export BGEE_CACHE_DIR="${BGEE_CACHE_DIR:-/tmp/bgee-cache}"
Rscript - "$INPUT_FILE_PATH" "$TMP_OUTPUT_DIR" <<'RSCRIPT'
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2L) stop("Expected input TSV path and output directory")
input <- read.delim(args[1], colClasses = "character", check.names = FALSE)
if (!identical(names(input), c("gene_id", "selected"))) stop("Expected TSV columns: gene_id, selected")
if (!nrow(input) || anyNA(input) || any(!nzchar(input$gene_id)) ||
    anyDuplicated(input$gene_id) || !all(input$selected %in% c("0", "1")) ||
    !any(input$selected == "1") || !any(input$selected == "0")) {
  stop("Input needs unique nonempty gene IDs and both 0 (background) and 1 (foreground) values")
}
dir.create(args[2], recursive = TRUE, showWarnings = FALSE)
cache <- Sys.getenv("BGEE_CACHE_DIR", "/tmp/bgee-cache")
dir.create(cache, recursive = TRUE, showWarnings = FALSE)
species <- Sys.getenv("BGEE_SPECIES", "Danio_rerio")
release <- Sys.getenv("BGEE_RELEASE", "15.2")
message("BgeeDB: species=", species, ", release=", release,
        ", genes=", nrow(input), ", foreground=", sum(input$selected == "1"))
suppressPackageStartupMessages(library(BgeeDB))
bgee <- Bgee$new(species = species, release = release, pathToData = cache)
anatomy <- loadTopAnatData(bgee)
selected <- factor(as.integer(input$selected), levels = c(0, 1))
names(selected) <- input$gene_id
analysis <- topAnat(anatomy, selected)
result <- runTest(analysis, algorithm = "weight", statistic = "fisher")
table <- makeTable(anatomy, analysis, result, cutoff = 1)
output <- file.path(args[2], "topanat-results.tsv")
write.table(table, output, sep = "\t", row.names = FALSE, quote = FALSE)
message("Wrote ", nrow(table), " anatomical terms to ", output)
RSCRIPT
