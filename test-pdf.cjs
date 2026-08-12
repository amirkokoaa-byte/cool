const { PDFParse } = require('pdf-parse');
async function test() {
  const parser = new PDFParse({ data: Buffer.from('hello') });
  try {
    const text = await parser.getText();
    console.log("Success", text);
  } catch (e) {
    console.log("Error", e.message);
  }
}
test();
