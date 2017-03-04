const cheerio = require('cheerio');
const charset = require('superagent-charset');
const superagent = charset(require('superagent'));
const pushQiniuImage = require('./util/pushQiniuImage').pushQiniuImage;
const Thenjs = require('thenjs');
const fs = require('fs');
const imageListPath = `${__dirname}/util/jobMes.json`;
let thenjsList = Thenjs;

const browserMsg = {
  'Accept-Encoding': 'gzip, deflate',
  'Origin': 'http://job.hrbust.edu.cn',
  'Content-Type': 'application/x-www-form-urlencoded',
};

function getJob (page) {
    let url = 'http://job.hrbust.edu.cn/Companys/List.aspx?zpXingshi=%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E4%BC%9A';
    if(page){
        url = `${url}&pagenum=${page}`;
    }
    const promise = new Promise((resolve,reject) => {
        superagent
            .get(url)
            .charset()
            .set(browserMsg)
            .end((err, response, body) => {
                if (err) {
                    console.log('get index is error');
                    resolve({
                        error:err,
                    });
                }else{
                    var body = response.text;
                    var $ = cheerio.load(body);
                    const result = {};
                    result.data = [];
                    const imageObj = {};
                    $("#ordered a").each((index,item) => {
                        const href = $(item).attr('href');
                        imageName = `jobUrl_${href.match(/\d+/g)[0]}.jpg`;
                        result.data.push({
                            title: $(item).text().trim(),
                            imageName,
                        });
                        imageObj[imageName] = `http://job.hrbust.edu.cn/Companys/${href}`;
                    });
                    thenjsList = thenjsList.series([
                        function(count){
                            handleUpdateImage(imageObj).then(() => {
                                cont();
                            });
                        }
                    ]);
                    resolve(result);
                }
            });
        });
    return promise;
}

function handleUpdateImage(imageObj) {
    const promise = new Promise((resolve) => {
        let imageObjJson = {};
        try{
            imageObjJson = JSON.parse(fs.readFileSync(imageListPath));
        } catch(e){
            console.log(e);
        }
        const promiseList = [];
        const result = Object.keys(imageObj).reduce((obj,item) => {
            if(!imageObjJson[item]){
                promiseList.push(pushQiniuImage(imageObj[item],item));
                return Object.assign({},obj,{
                    [item]:imageObj[item],
                });
            }
            return obj;
        },imageObjJson);
        Promise.all(promiseList).then(() => {
            fs.writeFileSync(imageListPath,JSON.stringify(result));
            resolve();
        });
    });
    return promise;
}

exports.getJob = getJob;