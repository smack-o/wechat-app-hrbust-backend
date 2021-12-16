// const sa = require('superagent');
const charset = require('superagent-charset')
const sa = charset(require('superagent'))
const uuidv4 = require('uuid/v4');

const queue = {};

const MAX_MOUNT = 2;

let executing = false;

const exeQueue = async () => {
  let list = Object.keys(queue);
  console.log(list.length, 'list length1')
  if (executing) {
    return;
  }
  executing = true;
  list = Object.keys(queue);
  console.log(list.length, 'list length2')
  const promises = list.splice(0, MAX_MOUNT).map(async (key) => {
    const res = await queue[key]();
    delete queue[key];
    return res;
  })

  await Promise.all(promises)
  list = Object.keys(queue);
  console.log(list.length, 'list length3')
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
      const req = Promise.all([delay(3000), fn().then((res) => {
        resolve(res)
      }).catch(reject)])

      return Promise.race([delay(10000).then(() => {
        return Promise.resolve('Timeout')
      }), req]).then((res) => {
        if (res === 'Timeout') {
          console.log('-------executingQueue Timeout-------');
          // 超时x
          return reject(new Error('Timeout'));
        }
        return res;
      })
    };
    // queue[id]().then(res => console.log(res))
  });

  exeQueue();
  return promise;
};


module.exports = executingQueue;