const xml2json = require('node-xml2json');
const request = require('request');
const fs = require('fs');

function getCaptcha(filePath) {
  const promise = new Promise((resolve) => {
    const formData = {
      file: fs.createReadStream(filePath),
    };

    request.post({
      url: 'http://lab.ocrking.com/ok.html?service=OcrKingForPhoneNumber&language=eng&charset=11&apiKey=ad6be37ba1c990d2faY7WmCyKfGkRcAA90nwglVA4V84JynHFE9lyPIosVFb0PijEwMP9BWgKciII&type=http://t.51chuli.com/contact/d827323fa035a7729w060771msa9211z.gif',
      formData,
    }, (err, httpResponse, body) => {
      if (err) {
        console.error('upload failed:', err);
        resolve({
          error: err,
        });
      }
      let bodyObj = {};
      bodyObj = xml2json.parser(body).results.resultlist;
      resolve(bodyObj);
    });
  });
  return promise;
}

module.exports = getCaptcha;
