const request = require('supertest')
const expect = require('chai').expect
const sinon = require('sinon')
const {sequelize} = require('../../src/model')
const { boot, cleanDB } = require('../utils')

describe('Balances endpoints', () => {
  let server

  before(async() => {
    server = await boot()
    await cleanDB()
  })

  describe('POST /balances/deposit/:userId', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .post('/balances/deposit/4')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return HTTP 403 if profile_id is not a client', async() => {
      const { status } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '5')

      expect(status).to.equal(403)
    })

    it('should return HTTP 400 if the amount parameter is missing', async() => {
      const { status, body } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')

      expect(status).to.equal(400)
      expect(body.validation.body.message).to.equal('"amount" is required')
    })

    it('should return HTTP 400 if the amount parameter is not a number', async() => {
      const { status, body } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')
        .send({ amount: 'invalid' })

      expect(status).to.equal(400)
      expect(body.validation.body.message).to.equal('"amount" must be a number')
    })

    it('should return HTTP 400 if the amount parameter is less than 1', async() => {
      const { status, body } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')
        .send({ amount: -1 })

      expect(status).to.equal(400)
      expect(body.validation.body.message).to.equal('"amount" must be greater than or equal to 1')
    })

    it('should return HTTP 400 if the user does not have enough funds', async() => {
      const { status, body } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')
        .send({ amount: 10000 })

      expect(status).to.equal(400)
      expect(body).to.deep.equal({ error: 'insufficient funds' })
    })

    it('should return HTTP 404 if the destination user does not exist', async() => {
      const { status } = await request(server)
        .post('/balances/deposit/454')
        .set('profile_id', '1')
        .send({ amount: 20 })

      expect(status).to.equal(404)
    })

    it('should return HTTP 404 if the destination user is a contractor', async() => {
      const { status } = await request(server)
        .post('/balances/deposit/5')
        .set('profile_id', '1')
        .send({ amount: 20 })

      expect(status).to.equal(404)
    })

    it('should return HTTP 400 if the amount exceeds the 25% of the unpaid jobs', async() => {
      const { status, body } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')
        .send({ amount: 1000 })

      expect(status).to.equal(400)
      expect(body).to.deep.equal({ error: 'the amount exceeds the 25% of unpaid jobs' })
    })

    it('should return HTTP 500 if the transaction fails', async() => {
      const { Profile } = sequelize.models

      const sourceClient = await Profile.findOne({where: {id: 1}})
      const destinationClient = await Profile.findOne({where: {id: 4}})

      sinon.stub(Profile, 'increment').onCall(1).rejects(new Error('Test Error'))

      const { status } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')
        .send({ amount: 100 })

      expect(status).to.equal(500)

      const postSourceClient = await Profile.findOne({where: {id: sourceClient.id}})
      expect(postSourceClient).to.exist
      expect(postSourceClient.balance).to.equal(sourceClient.balance)

      const postDestinationClient = await Profile.findOne({where: {id: destinationClient.id}})
      expect(postDestinationClient).to.exist
      expect(postDestinationClient.balance).to.equal(destinationClient.balance)

      sinon.restore()
    })

    it('should make the deposit successfully', async() => {
      const { Profile } = sequelize.models

      const sourceClient = await Profile.findOne({where: {id: 1}})
      const destinationClient = await Profile.findOne({where: {id: 4}})

      const { status } = await request(server)
        .post('/balances/deposit/4')
        .set('profile_id', '1')
        .send({ amount: 100 })

      expect(status).to.equal(200)

      const postSourceClient = await Profile.findOne({where: {id: sourceClient.id}})
      expect(postSourceClient).to.exist
      expect(postSourceClient.balance).to.equal(sourceClient.balance - 100)

      const postDestinationClient = await Profile.findOne({where: {id: destinationClient.id}})
      expect(postDestinationClient).to.exist
      expect(postDestinationClient.balance).to.equal(destinationClient.balance + 100)
    })
  })
})
