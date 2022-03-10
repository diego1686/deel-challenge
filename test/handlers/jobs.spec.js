const request = require('supertest')
const expect = require('chai').expect
const sinon = require('sinon')
const {sequelize} = require('../../src/model')
const { boot, cleanDB } = require('../utils')

describe('Jobs endpoints', () => {
  let server

  before(async() => {
    server = await boot()
    await cleanDB()
  })

  describe('GET /jobs/unpaid', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .get('/jobs/unpaid')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .get('/jobs/unpaid')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return all the unpaid jobs with contract status in-progress for a client', async() => {
      const { status, body } = await request(server)
        .get('/jobs/unpaid')
        .set('profile_id', '1')

      expect(status).to.equal(200)
      expect(body).to.be.an('array').that.has.length(1)
      const [job] = body
      expect(job).to.have.all.keys(
        'id', 'description', 'price', 'paid', 'paymentDate', 'createdAt', 'updatedAt', 'ContractId'
      )
      expect(job.paid).to.be.null
    })

    it('should return all the unpaid jobs with contract status in-progress for a contractor', async() => {
      const { status, body } = await request(server)
        .get('/jobs/unpaid')
        .set('profile_id', '7')

      expect(status).to.equal(200)
      expect(body).to.be.an('array').that.has.length(2)
    })
  })

  describe('POST /jobs/:job_id/pay', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .post('/jobs/1/pay')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .post('/jobs/1/pay')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return HTTP 403 if profile_id is not a client', async() => {
      const { status } = await request(server)
        .post('/jobs/1/pay')
        .set('profile_id', '5')

      expect(status).to.equal(403)
    })

    it('should return HTTP 404 if the job does not exist', async() => {
      const { status } = await request(server)
        .post('/jobs/145/pay')
        .set('profile_id', '1')

      expect(status).to.equal(404)
    })

    it('should return HTTP 404 if the job belongs to another client', async() => {
      const { status } = await request(server)
        .post('/jobs/3/pay')
        .set('profile_id', '1')

      expect(status).to.equal(404)
    })

    it('should return HTTP 404 if the job is already paid', async() => {
      const { status } = await request(server)
        .post('/jobs/6/pay')
        .set('profile_id', '4')

      expect(status).to.equal(404)
    })

    it('should return HTTP 400 if the user does not have enough funds', async() => {
      const { status, body } = await request(server)
        .post('/jobs/5/pay')
        .set('profile_id', '4')

      expect(status).to.equal(400)
      expect(body).to.deep.equal({ error: 'insufficient funds' })
    })

    it('should return HTTP 500 if the transaction fails', async() => {
      const { Job, Profile, Contract } = sequelize.models

      // Preconditions
      const preJob = await Job.findOne({
        where: {id: 1},
        include: [{
          model: Contract
        }]
      })
      expect(preJob.paid).to.be.null
      expect(preJob.paymentDate).to.be.null

      const client = await Profile.findOne({where: {id: preJob.Contract.ClientId}})
      const contractor = await Profile.findOne({where: {id: preJob.Contract.ContractorId}})

      sinon.stub(Job, 'update').rejects(new Error('Test Error'))

      const { status } = await request(server)
        .post('/jobs/1/pay')
        .set('profile_id', client.id)

      expect(status).to.equal(500)

      // Check the transaction was reverted
      const postJob = await Job.findOne({
        where: {id: 1},
      })
      expect(postJob.paid).to.be.null
      expect(postJob.paymentDate).to.be.null

      const postClient = await Profile.findOne({where: {id: preJob.Contract.ClientId}})
      expect(postClient).to.exist
      expect(postClient.balance).to.equal(client.balance)

      const postContractor = await Profile.findOne({where: {id: preJob.Contract.ContractorId}})
      expect(postContractor).to.exist
      expect(postContractor.balance).to.equal(contractor.balance)

      sinon.restore()
    })

    it('should make the payment successfully', async() => {
      const { Job, Profile, Contract } = sequelize.models

      // Preconditions
      const preJob = await Job.findOne({
        where: {id: 1},
        include: [{
          model: Contract
        }]
      })
      expect(preJob.paid).to.be.null
      expect(preJob.paymentDate).to.be.null

      const client = await Profile.findOne({where: {id: preJob.Contract.ClientId}})
      const contractor = await Profile.findOne({where: {id: preJob.Contract.ContractorId}})

      const { status } = await request(server)
        .post('/jobs/1/pay')
        .set('profile_id', client.id)

      expect(status).to.equal(200)

      // Check the current state
      const postJob = await Job.findOne({
        where: {id: 1},
      })
      expect(postJob.paid).to.be.true
      expect(postJob.paymentDate).to.not.be.null

      const postClient = await Profile.findOne({where: {id: preJob.Contract.ClientId}})
      expect(postClient).to.exist
      expect(postClient.balance).to.equal(client.balance - postJob.price)

      const postContractor = await Profile.findOne({where: {id: preJob.Contract.ContractorId}})
      expect(postContractor).to.exist
      expect(postContractor.balance).to.equal(contractor.balance + postJob.price)
    })
  })
})
