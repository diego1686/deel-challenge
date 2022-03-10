
const getProfile = async (req, res, next) => {
    const {Profile} = req.app.get('models')
    const profile = await Profile.findOne({where: {id: req.get('profile_id') || 0}})
    if(!profile) return res.status(401).end()
    req.profile = profile
    next()
}

/**
 * @description Checks the type of the current profile. If the type is not valid,
 * a 401 error is returned to the client.
 *
 * @param {string} type - The allowed profile type.
 *
 */
const checkProfileType = type => (req, res, next) => {
    if (req.profile.type !== type) return res.status(401).end()
    next()
}

module.exports = {
    getProfile,
    checkProfileType
}