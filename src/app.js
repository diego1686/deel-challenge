const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * @returns contract by id
 */
app.get('/contracts/:id',getProfile ,async (req, res) =>{
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
 app.post('/jobs/:job_id/pay', getProfile, async (req, res) =>{
    const {Job, Contract, Profile} = req.app.get('models')
    const {profile, params: {job_id}} = req
    const job = await Job.scope('unpaid').findOne({
        where: {id: job_id},
        include: [{
            model: Contract,
            where: {ClientId: profile.id}
        }]
    })
    if(!job) return res.status(404).end()
    if (profile.balance < job.price) return res.status(400).json({ result: 'insufficient funds' })

    try {
        const {Contract: contract} = job

        await sequelize.transaction(async (transaction) => {
            await Profile.increment({balance: -job.price}, {
                where: {id: contract.ClientId},
                transaction
            })

            await Profile.increment({balance: job.price}, {
                where: {id: contract.ContractorId},
                transaction
            })

            await Job.update({paid: true, paymentDate: Date.now()}, {
                where: {id: job.id},
                transaction
            })
        })

        res.status(200).end()
    } catch (error) {
        console.log('Job cannot be paid', error.message) // todo: improve this with express
        res.status(500).end()
    }
})
module.exports = app;
