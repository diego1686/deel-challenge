const Sequelize = require('sequelize');
const { Op } = Sequelize

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite3'
});

class Profile extends Sequelize.Model {
  /**
   * @description Makes a deposit to a given user
   *
   * @param {Object} params - Deposit parameters.
   * @param {string} params.userId - The Id of the desintation user
   * @param {number} params.amount - The amount to be deposited
   *
   * @returns {Promise<undefined>} A promise that will be resolved with no value
   * if the deposit was made successfully. In any other case, the promise will
   * be rejected with the appropriate error.
   */
  async deposit({ userId, amount }) {
    const profile = this

    await sequelize.transaction(async (transaction) => {
        await Profile.increment({balance: -amount}, {
            where: {id: profile.id},
            transaction
        })

        await Profile.increment({balance: amount}, {
            where: {id: userId},
            transaction
        })
    })
  }
}
Profile.init(
  {
    firstName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    lastName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    profession: {
      type: Sequelize.STRING,
      allowNull: false
    },
    balance:{
      type:Sequelize.DECIMAL(12,2)
    },
    type: {
      type: Sequelize.ENUM('client', 'contractor')
    }
  },
  {
    sequelize,
    modelName: 'Profile'
  }
);

class Contract extends Sequelize.Model {}
Contract.init(
  {
    terms: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    status:{
      type: Sequelize.ENUM('new','in_progress','terminated')
    }
  },
  {
    scopes: {
      byProfile(profile) {
        const where = profile.type === 'client' ? {ClientId: profile.id} : {ContractorId: profile.id}
        return {where}
      },
      byStatuses(statuses) {
        return {where: {status: {[Op.in]: statuses}}}
      }
    },
    sequelize,
    modelName: 'Contract'
  }
);

class Job extends Sequelize.Model {
  /**
   * @description Pays the current job
   *
   * @param {Object} params - Payment parameters.
   * @param {string} params.clientId - The Id of the client making the payment
   * @param {string} params.contractorId - The Id of the contractor getting paid
   *
   * @returns {Promise<undefined>} A promise that will be resolved with no value
   * if the job was paid successfully. In any other case, the promise will
   * be rejected with the appropriate error.
   */
  async pay({ clientId, contractorId }) {
    const job = this

    await sequelize.transaction(async (transaction) => {
        await Profile.increment({balance: -job.price}, {
            where: {id: clientId},
            transaction
        })

        await Profile.increment({balance: job.price}, {
            where: {id: contractorId},
            transaction
        })

        await Job.update({paid: true, paymentDate: Date.now()}, {
            where: {id: job.id},
            transaction
        })
    })
  }
}
Job.init(
  {
    description: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    price:{
      type: Sequelize.DECIMAL(12,2),
      allowNull: false
    },
    paid: {
      type: Sequelize.BOOLEAN,
      default:false
    },
    paymentDate:{
      type: Sequelize.DATE
    }
  },
  {
    scopes: {
      unpaid: {
        where: {paid: {[Op.not]: true}}
      },
      paid: {
        where: {paid: true}
      }
    },
    sequelize,
    modelName: 'Job'
  }
);

Profile.hasMany(Contract, {as :'Contractor',foreignKey:'ContractorId'})
Contract.belongsTo(Profile, {as: 'Contractor'})
Profile.hasMany(Contract, {as : 'Client', foreignKey:'ClientId'})
Contract.belongsTo(Profile, {as: 'Client'})
Contract.hasMany(Job)
Job.belongsTo(Contract)

module.exports = {
  sequelize,
  Profile,
  Contract,
  Job
};
