// const sa = require('superagent');
const charset = require('superagent-charset')
const sa = charset(require('superagent'))
const uuidv4 = require('uuid/v4');

const queue = {};

const MAX_MOUNT = 5;

let executing = false;

const exeQueue = async () => {
  if (executing) {
    return;
  }
  executing = true;
  let list = Object.keys(queue);
  console.log(list.length, 'list length')
  const promises = list.splice(0, MAX_MOUNT).map(async (key) => {
    console.log(queue[key])
    const res = await queue[key]();
    delete queue[key];
    return res;
  })

  await Promise.all(promises)
  list = Object.keys(queue);
  console.log(list.length, 'list length2')
  executing = false;
  if (list.length > 0) {
    exeQueue();
  }
}

const delay = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout))

function executingQueue(fn) {
  const promise = new Promise((resolve, reject) => {
    const id = uuidv4();
    queue[id] = () => {
      return Promise.all([delay(4000), fn().then((res) => {
        resolve(res)
      }).catch(reject)])
    };
    // queue[id]().then(res => console.log(res))
  });

  exeQueue();
  return promise;
};


module.exports = executingQueue;
