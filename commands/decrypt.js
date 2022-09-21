#!/usr/bin/env node
const args = process.argv.slice(2)
const password = args[0]
const secret = args[1]
// console.log(args);
const crypto = require('crypto')
const algorithm_256 = 'aes-256-cbc'

function decrypt(text, password, algorithm) {
  try {
    const decipher = crypto.createDecipher(algorithm, password)
    let dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  } catch (error) {
    return 'Not able to decrypt'
  }
}

// const message = "11757400c368b36fa8e4299024d6e6f66268b86393e4c7a6e5f4bcfb150cfd851e9a591dc933f9cc367e3c4ebc1b6fc60fd073ff226e722be8445abe98caa6d65cab987f0f5269aaef11b63de3c893d596dbc6098f744c7129a42a3674ca6f3b1d1214b9680fd7fe1e2c2c7ae93098f5f5e1b45d1d3ba2bce7f751840a73de35b39bc27e61416e63804cfb8d7d202bdc04fde03c1f92eb4dc4152905a0a28910075415164bd4745a272bd1b35c40b5ac31e0777dc668d5f72f2e7e6f1a0a6b48af5adff9afe124df31bbfa3fea6389fd39ef90c258a1f4a29f7eaf51efa908de0cf11b0afad873ed12c944872ada7ab69b8e04f6ef937156a50bd442b307b63e017dfaf17b0d582f4675e7fbffc517aa6791050229af0361f26f83bfbb792cad13bd128aac7bc7b5a1cd7942b6501054fe476b31a28dfa4d64c16a8e160eb74750259e3b9233dadd43c8c62d60423792a4c07b446b63f44e3dd373972a2326067841b3c6a24526423799c752140743b0"
// const password = 'ht84ham9'

const out = decrypt(secret, password, algorithm_256)

const result = JSON.parse(out)

console.log('\n\n')
console.log('###########################################################')
console.log('password: ', password)
console.log('message:')
console.log(result)
