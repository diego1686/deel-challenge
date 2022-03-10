const {seed} = require('../../scripts/initDb');

const cleanDB = async() => {
  await seed()
}

module.exports = cleanDB
