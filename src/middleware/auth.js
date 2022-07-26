const jwt = require("jsonwebtoken");
const validator = require("../validator/validator");
const userModel = require("../model/userModel");

const authentication = async function (req, res, next) {
    try {

        let token;
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            token = req.headers.authorization.split(' ')[1]
        }

        if (!token) {
            return res.status(400).send({ status: false, message: "token is missing." })
        }
        
        jwt.verify(token, "project5Group8", function (err, decoded) {
            if (err) {
                return res.status(401).send({ status: false, message: "token invalid" })
            } else {
                if (Date.now() > decoded.exp * 1000) {
                    return res.status(401).send({ status: false, message: "token is expired" })
                }
                req.userId = decoded.userId
                next();
            }
        })

    } catch (error) {
        return res.status(500).send({ status: false, message: err.message })
    }
}


const Authorization = async function (req, res, next) {
    try {

        let tokenUserId = req.userId
        let userId = req.params.userId
     
        if (!validator.isValidObjectId(userId)) return res.status(400).send({ status: false, message: "userId is not valid" });

        //check the  user id are present in decoded token
        let User = await userModel.findOne({_id:userId,isDeleted:false})
        if (!User) return res.status(404).send({ status: false, msg: "User not exist" })
        if (userId != tokenUserId) { return res.status(403).send({ status: false, msg: "Not Authorised!!" }) }

        next()
    }
    catch (err) {
        return res.status(500).send({ status: false, msg: err.message });
    }
}


module.exports = { authentication, Authorization }