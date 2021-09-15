const fs = require('fs');

const hasJsonStructure = (str) => {
  if (typeof str !== 'string') return false;
  try {
    const result = JSON.parse(str);
    const type = Object.prototype.toString.call(result);
    return type === '[object Object]' || type === '[object Array]';
  } catch (err) {
    return false;
  }
};

const loadInitialJFSImage = () => {
  const initialJFSImage = fs.readFileSync('./pixi.jpg', {encoding: 'base64'});
  return initialJFSImage;
}

module.exports = {
  hasJsonStructure,
  loadInitialJFSImage,
};
