const request = require('supertest')
const expect = require('chai').expect
const { boot, cleanDB } = require('../utils')

describe('Contracts endpoints', () => {
  let server

  before(async() => {
    server = await boot()
    await cleanDB()
  })

  describe('GET /contracts', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .get('/contracts')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .get('/contracts')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return all the non-terminated contracts for a client', async() => {
      const { status, body } = await request(server)
        .get('/contracts')
        .set('profile_id', '1')

      expect(status).to.equal(200)
      expect(body).to.be.an('array').that.has.length(1)
      const [contract] = body
      expect(contract).to.have.all.keys(
        'id', 'terms', 'status', 'createdAt', 'updatedAt', 'ContractorId', 'ClientId'
      )
      expect(contract.ClientId).to.equal(1)
      expect(contract.status).to.equal('in_progress')
    })

    it('should return all the non-terminated contracts for a contractor', async() => {
      const { status, body } = await request(server)
        .get('/contracts')
        .set('profile_id', '8')

      expect(status).to.equal(200)
      expect(body).to.be.an('array').that.has.length(2)

      const [contract1, contract2] = body
      expect(contract1).to.have.all.keys(
        'id', 'terms', 'status', 'createdAt', 'updatedAt', 'ContractorId', 'ClientId'
      )
      expect(contract1.ContractorId).to.equal(8)
      expect(contract1.status).to.equal('new')

      expect(contract2).to.have.all.keys(
        'id', 'terms', 'status', 'createdAt', 'updatedAt', 'ContractorId', 'ClientId'
      )
      expect(contract2.ContractorId).to.equal(8)
      expect(contract2.status).to.equal('in_progress')
    })

    it('should return an empty array if there is no non-terminated contracts for the current profile', async() => {
      const { status, body } = await request(server)
        .get('/contracts')
        .set('profile_id', '5')

      expect(status).to.equal(200)
      expect(body).to.be.an('array').that.has.length(0)
    })
  })

  describe('GET /contracts/:id', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .get('/contracts/1')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .get('/contracts/1')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return HTTP 404 if the contract does not exist', async() => {
      const { status } = await request(server)
        .get('/contracts/17865')
        .set('profile_id', '1')

      expect(status).to.equal(404)
    })

    it('should return HTTP 404 if the contract belongs to another client', async() => {
      const { status } = await request(server)
        .get('/contracts/3')
        .set('profile_id', '1')

      expect(status).to.equal(404)
    })

    it('should return HTTP 404 if the contract belongs to another contractor', async() => {
      const { status } = await request(server)
        .get('/contracts/3')
        .set('profile_id', '5')

      expect(status).to.equal(404)
    })

    it('should return the contract details for a client', async() => {
      const { status, body } = await request(server)
        .get('/contracts/1')
        .set('profile_id', '1')

      expect(status).to.equal(200)
      expect(body).to.have.all.keys(
        'id', 'terms', 'status', 'createdAt', 'updatedAt', 'ContractorId', 'ClientId'
      )
      expect(body.id).to.equal(1)
      expect(body.ClientId).to.equal(1)
    })

    it('should return the contract details for a contractor', async() => {
      const { status, body } = await request(server)
        .get('/contracts/1')
        .set('profile_id', '5')

      expect(status).to.equal(200)
      expect(body).to.have.all.keys(
        'id', 'terms', 'status', 'createdAt', 'updatedAt', 'ContractorId', 'ClientId'
      )
      expect(body.id).to.equal(1)
      expect(body.ContractorId).to.equal(5)
    })
  })
})
