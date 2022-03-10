const request = require('supertest')
const expect = require('chai').expect
const sinon = require('sinon')
const {sequelize} = require('../../src/model')
const { boot, cleanDB } = require('../utils')

describe('Admin endpoints', () => {
  let server

  before(async() => {
    server = await boot()
    await cleanDB()
  })

  describe('GET /admin/best-profession', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .get('/admin/best-profession')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return HTTP 400 if the start parameter is an invalid date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', '1')
        .query({ start: 'invalid' })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"start" must be in ISO 8601 date format')
    })

    it('should return HTTP 400 if the end parameter is an invalid date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', '1')
        .query({ end: 'invalid' })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"end" must be in ISO 8601 date format')
    })

    it('should return the best all-time profession', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', '1')

      expect(status).to.equal(200)
      expect(body).to.deep.equal({ total: 2683, profession: 'Programmer' })
    })

    it('should return the best profession after a date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', '1')
        .query({ start: '2020-08-17T00:00:00.007Z' })

      expect(status).to.equal(200)
      expect(body).to.deep.equal({ total: 200, profession: 'Musician' })
    })

    it('should return the best profession before a date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', '1')
        .query({ end: '2020-08-17T00:00:00.007Z' })

      expect(status).to.equal(200)
      expect(body).to.deep.equal({ total: 2683, profession: 'Programmer' })
    })

    it('should return the best profession bwtween two dates', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-profession')
        .set('profile_id', '1')
        .query({ start: '2020-08-16T00:00:00.007Z', end: '2020-08-17T00:00:00.007Z' })

      expect(status).to.equal(200)
      expect(body).to.deep.equal({ total: 200, profession: 'Programmer' })
    })
  })

  describe('GET /admin/best-clients', () => {
    it('should return HTTP 401 if profile_id is not provided', async() => {
      const { status } = await request(server)
        .get('/admin/best-clients')

      expect(status).to.equal(401)
    })

    it('should return HTTP 401 if profile_id is not found', async() => {
      const { status } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', 'invalid')

      expect(status).to.equal(401)
    })

    it('should return HTTP 400 if the start parameter is an invalid date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ start: 'invalid' })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"start" must be in ISO 8601 date format')
    })

    it('should return HTTP 400 if the end parameter is an invalid date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ end: 'invalid' })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"end" must be in ISO 8601 date format')
    })

    it('should return HTTP 400 if the limit parameter is invalid', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ limit: 'invalid' })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"limit" must be a number')
    })

    it('should return HTTP 400 if the limit parameter is less than 1', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ limit: 0 })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"limit" must be greater than or equal to 1')
    })

    it('should return HTTP 400 if the limit parameter is greater than 100', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ limit: 101 })

      expect(status).to.equal(400)
      expect(body.validation.query.message).to.equal('"limit" must be less than or equal to 100')
    })

    it('should return the best all-time clients with a default limit of 2', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')

      expect(status).to.equal(200)
      expect(body.length).to.equal(2)
      expect(body).to.deep.equal([
        { id: 4, fullName: 'Ash Kethcum', paid: 2020 },
        { id: 2, fullName: 'Mr Robot', paid: 442 }
      ])
    })

    it('should return the best all-time clients with a limit of 3', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ limit: 3 })

      expect(status).to.equal(200)
      expect(body.length).to.equal(3)
      expect(body).to.deep.equal([
        { id: 4, fullName: 'Ash Kethcum', paid: 2020 },
        { id: 2, fullName: 'Mr Robot', paid: 442 },
        { id: 1, fullName: 'Harry Potter', paid: 442 }
      ])
    })

    it('should return the best clients after a date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ start: '2020-08-17T00:00:00.007Z' })

      expect(status).to.equal(200)
      expect(body.length).to.equal(2)
      expect(body).to.deep.equal([
        { id: 3, fullName: 'John Snow', paid: 200 },
        { id: 1, fullName: 'Harry Potter', paid: 200 }
      ])
    })

    it('should return the best clients before a date', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ end: '2020-08-17T00:00:00.007Z' })

      expect(status).to.equal(200)
      expect(body.length).to.equal(2)
      expect(body).to.deep.equal([
        { id: 4, fullName: 'Ash Kethcum', paid: 2020 },
        { id: 2, fullName: 'Mr Robot', paid: 442 }
      ])
    })

    it('should return the best clients bwtween two dates', async() => {
      const { status, body } = await request(server)
        .get('/admin/best-clients')
        .set('profile_id', '1')
        .query({ start: '2020-08-15T00:00:00.007Z', end: '2020-08-17T00:00:00.007Z' })

      expect(status).to.equal(200)
      expect(body.length).to.equal(2)
      expect(body).to.deep.equal([
        { id: 4, fullName: 'Ash Kethcum', paid: 2020 },
        { id: 2, fullName: 'Mr Robot', paid: 321 }
      ])
    })
  })
})
