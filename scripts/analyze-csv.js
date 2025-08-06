// Let's fetch and analyze the CSV structure
async function analyzeCommunicationCSV() {
  try {
    console.log("Fetching CSV file...")
    const response = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/en-ja_communication-hz8baiSJSY3Q84i16UkJsJusAxu1Qd.csv",
    )
    const csvContent = await response.text()

    console.log("Raw CSV content (first 500 chars):")
    console.log(csvContent.substring(0, 500))

    // Split into lines and analyze structure
    const lines = csvContent.trim().split("\n")
    console.log(`\nTotal lines: ${lines.length}`)

    // Look at first few lines to understand structure
    console.log("\nFirst 5 lines:")
    lines.slice(0, 5).forEach((line, index) => {
      console.log(`Line ${index}: ${line}`)
    })

    // Analyze the pattern - looks like it might be semicolon separated
    const sampleLine = lines[0]
    console.log("\nAnalyzing separator patterns:")
    console.log(`Commas: ${(sampleLine.match(/,/g) || []).length}`)
    console.log(`Semicolons: ${(sampleLine.match(/;/g) || []).length}`)
    console.log(`Tabs: ${(sampleLine.match(/\t/g) || []).length}`)

    // Try parsing with semicolon separator
    console.log("\nParsing with semicolon separator:")
    const parsedLines = lines.slice(0, 10).map((line) => {
      const parts = line.split(";")
      return {
        japanese: parts[0]?.trim(),
        english: parts[1]?.trim(),
        extra1: parts[2]?.trim(),
        extra2: parts[3]?.trim(),
        totalParts: parts.length,
      }
    })

    console.log("Parsed structure:")
    parsedLines.forEach((parsed, index) => {
      console.log(`Line ${index}:`, parsed)
    })
  } catch (error) {
    console.error("Error analyzing CSV:", error)
  }
}

analyzeCommunicationCSV()
