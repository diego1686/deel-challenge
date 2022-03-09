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
app.get('/contracts',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const contracts = await Contract
        .scope({method: ['byProfile', req.profile]}, {method: ['byStatuses', ['new', 'in_progress']]})
        .findAll()
    res.json(contracts)
})

/**
 * @returns all unpaid jobs for a user, for active contracts only
 */
app.get('/jobs/unpaid',getProfile ,async (req, res) =>{
    const {Job, Contract} = req.app.get('models')
    const jobs = await Job.findAll({
        include: [{
            model: Contract
                .scope({method: ['byProfile', req.profile]}, {method: ['byStatuses', ['in_progress']]})
        }],
    })
    res.json(jobs)
})
module.exports = app;
