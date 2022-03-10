const express = require('express');
const bodyParser = require('body-parser');
const _ = require('lodash')
const { Op } = require('sequelize');
const {sequelize} = require('./model')
const {getProfile, checkProfileType} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) =>{
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.scope({method: ['byProfile', req.profile]}).findOne({where: {id}})
    if(!contract) return res.status(404).end()
    res.json(contract)
})

/**
 * @returns all non terminated contracts
 */
app.get('/contracts', getProfile, async (req, res) =>{
    const {Contract} = req.app.get('models')
    const contracts = await Contract
        .scope({method: ['byProfile', req.profile]}, {method: ['byStatuses', ['new', 'in_progress']]})
        .findAll()
    res.json(contracts)
})

/**
 * @returns all unpaid jobs for a user, for active contracts only
 */
app.get('/jobs/unpaid', getProfile, async (req, res) =>{
    const {Job, Contract} = req.app.get('models')
    const jobs = await Job.scope('unpaid').findAll({
        include: [{
            model: Contract
                .scope({method: ['byProfile', req.profile]}, {method: ['byStatuses', ['in_progress']]})
        }]
    })
    res.json(jobs)
})

/**
 * @returns
 */
 app.post('/jobs/:job_id/pay', getProfile, checkProfileType('client'), async (req, res) =>{
    const {Job, Contract} = req.app.get('models')
    const {profile, params: {job_id}} = req
    const job = await Job.scope('unpaid').findOne({
        where: {id: job_id},
        include: [{
            model: Contract.scope({method: ['byProfile', req.profile]})
        }]
    })
    if(!job) return res.status(404).end()
    if (profile.balance < job.price) return res.status(400).json({ error: 'insufficient funds' })

    try {
        const {Contract: contract} = job
        await job.pay({ clientId: contract.ClientId, contractorId: contract.ContractorId })
        res.status(200).end()
    } catch (error) {
        console.log('Job cannot be paid', error.message) // todo: improve this with express
        res.status(500).end()
    }
})

app.post('/balances/deposit/:userId', getProfile, checkProfileType('client'), async (req, res) =>{
    const {Profile, Job, Contract} = req.app.get('models')
    const {profile, params: {userId}, body: {amount}} = req

    // Check profile balance
    if (profile.balance < amount) return res.status(400).json({ error: 'insufficient funds' })

    // Get destination user
    const user = await Profile.findOne({
        where: {id: userId, type: 'client'},
    })
    if(!user) return res.status(404).end()

    // Get all the unpaid jobs for the current profile
    const jobs = await Job.scope('unpaid').findAll({
        include: [{
            model: Contract.scope({method: ['byProfile', req.profile]})
        }]
    })

    // Calculate the unpaid jobs total
    const total = _.sumBy(jobs, 'price')
    if ((total * 25 / 100) < amount) return res.status(400).json({ error: 'the amount exceeds the 25% of unpaid jobs' })

    try {
        await profile.deposit({ userId, amount })
        res.status(200).end()
    } catch (error) {
        console.log('Error making deposit', error.message) // todo: improve this with express
        res.status(500).end()
    }
})

app.get('/admin/best-profession', getProfile, async (req, res) =>{
    const {Job, Contract} = req.app.get('models')
    const {start, end} = req.query

    const dates = []
    if (start) dates.push({ paymentDate: { [Op.gte]: start } })
    if (end) dates.push({ paymentDate: { [Op.lte]: end } })

    const job = await Job.scope('paid').findOne({
        where: { [Op.and]: dates },
        include: [{
            model: Contract,
            include: 'Contractor',
            attributes: []
        }],
        group: 'Contract.Contractor.profession',
        attributes: [
            [sequelize.fn('sum', sequelize.col('price')), 'total'],
            [sequelize.col('Contract.Contractor.profession'), 'profession'],
        ],
        order: [[sequelize.col('total'), 'DESC']]
    })

    res.json(_.defaultTo(job, {}))
})

app.get('/admin/best-clients', getProfile, async (req, res) =>{
    const {Job, Contract} = req.app.get('models')
    const {start, end} = req.query
    const limit = _.get(req, 'query.limit', 2)

    const dates = []
    if (start) dates.push({ paymentDate: { [Op.gte]: start } })
    if (end) dates.push({ paymentDate: { [Op.lte]: end } })

    let jobs = await Job.scope('paid').findAll({
        where: { [Op.and]: dates },
        include: [{
            model: Contract,
            include: 'Client',
            attributes: []
        }],
        group: 'Contract.Client.id',
        attributes: [
            [sequelize.col('Contract.Client.id'), 'id'],
            [sequelize.col('Contract.Client.firstName'), 'firstName'],
            [sequelize.col('Contract.Client.lastName'), 'lastName'],
            [sequelize.fn('sum', sequelize.col('price')), 'paid'],
        ],
        order: [[sequelize.col('paid'), 'DESC']],
        limit,
        raw: true,
        nest: true
    })

    jobs = _.map(jobs, (j) => {
        return {
            id: j.id,
            fullName: `${j.firstName} ${j.lastName}`,
            paid: j.paid
        }
    })
    res.json(jobs)
})

module.exports = app;
