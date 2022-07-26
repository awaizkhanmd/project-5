const orderModel = require('../model/orderModel')
const cartModel = require('../model/cartModel')
const userModel = require('../model/userModel')
const validator = require("../validator/validator")
const mongoose = require("mongoose")
//1st Api - Creating Order

const createOrder = async function (req,res) {
    try {
        let userId = req.params.userId;
        let requestBody = req.body
        let {cartId, cancellable, status } = requestBody;
        let tokenUserId = req.userId;


        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send({status:false,message:'userId is not a valid '})
        }

        if (Object.keys(requestBody).length==0) {
            return res.status(400).send({status:false,message:'please enter value in req body'})
        }

        if(!mongoose.Types.ObjectId.isValid(cartId)) {
            return res.status(400).send({status:false,message:'cartId is not valid '})
        }
        if (requestBody.hasOwnProperty("cancellable")) {
            if (typeof cancellable != "boolean") {
                return res.status(400).send({status: false,message: `Cancellable must be either 'true' or 'false'.`,});
            }
        }

        if (requestBody.hasOwnProperty("status")) {
            if (!(status=="pending"||status=="completed"||status=="cancelled")) {
                return res.status(400).send({status: false,message: `Status must be among ['pending','completed','cancelled'].`,});
            }
        }

        const findUser = await userModel.findOne({_id:userId,isDeleted:false});

        if(!findUser) {
            return res.status(404).send({status:false,message:'User does not Exist'})
        }

        //Authorisation

        // if (findUser._id != tokenUserId) {
        //     return res.status(403).send({status:false,message:'Unauthorised Access'})
        // }

        const findCart = await cartModel.findOne({_id: cartId,userId: userId,isDeleted:false});

        if (!findCart) {
            return res.status(400).send({status: false,message: `Cart doesn't belongs to ${userId}`,});
        }

        if (findCart.items.length == 0) {
            return res.status(400).send({status:false,message:'No items in cart, Please put items in cart first'})
        }

    let totalQuantity =0
    for(let i =0;i<findCart.items.length;i++){
       totalQuantity += findCart.items[i].quantity
    }

    //object destructuring for response body.
    const orderDetails = {
        userId: userId,
        items: findCart.items,
        totalPrice: findCart.totalPrice,
        totalItems: findCart.totalItems,
        totalQuantity: totalQuantity,
        cancellable,
        status,
    };
    const savedOrder = await orderModel.create(orderDetails);

    //Empty the cart after the successfull order
    await cartModel.findOneAndUpdate({ _id: cartId, userId: userId }, {
        $set: {
            items: [],
            totalPrice: 0,
            totalItems: 0,
        },
    });

    return res.status(200).send({ status: true, message: "Order placed.", data: savedOrder });

    } catch (err) {
        return res.status(500).send({status:false,message:err.message})
    }
}


//2nd Api - updating order
const updateOrder = async function (req, res)  {
    try {
        const userId = req.params.userId;
        const requestBody = req.body;
        const userIdFromToken = req.userId

        //validating request body.
        if (!validator.isValidBody(requestBody)) {
            return res.status(400).send({status: false,message: "Invalid request body. Please provide the the input to proceed.",});
        }
        //extract params
        const { orderId, status } = requestBody;
        if (!validator.isValidObjectId(userId)) {
            return res.status(400).send({ status: false, message: "Invalid userId in params." });
        }
        const searchUser = await userModel.findOne({ _id: userId });
        if (!searchUser) {
            return res.status(400).send({status: false,message: `user doesn't exists for ${userId}`,});
        }

        //Authentication & authorization
        // if (searchUser._id.toString() != userIdFromToken) {
        //     return res.status(401).send({ status: false, message: `Unauthorized access! User's info doesn't match` });
            
        // }

        if (!orderId) {
            return res.status(400).send({status: false,message: `Order doesn't exists for ${orderId}`,});
        }

        //verifying does the order belongs to user or not.
        isOrderBelongsToUser = await orderModel.findOne({ userId: userId });
        if (!isOrderBelongsToUser) {
            return res.status(400).send({status: false,message: `Order doesn't belongs to ${userId}`,});
        }

        if (!status) {
            return res.status(400).send({status: true,message: "Mandatory paramaters not provided. Please enter current status of the order."});
        }
        if (!(status)) {
            return res.status(400).send({status: true,message: "Invalid status in request body. Choose either 'pending','completed', or 'cancelled'."});
        }

        //if cancellable is true then status can be updated to any of te choices.
        if (isOrderBelongsToUser["cancellable"] == true) {
            if ((status=="pending"||status=="completed"||status=="cancelled")) {
                if (isOrderBelongsToUser['status'] == 'pending') {
                    const updateStatus = await orderModel.findOneAndUpdate({ _id: orderId }, {
                        $set: { status: status }
                    }, { new: true })
                    return res.status(200).send({ status: true, message: `Successfully updated the order details.`, data: updateStatus })
                }

                //if order is in completed status then nothing can be changed/updated.
                if (isOrderBelongsToUser['status'] == 'completed') {
                    return res.status(400).send({ status: false, message: `Unable to update or change the status, because it's already in completed status.` })
                }

                //if order is already in cancelled status then nothing can be changed/updated.
                if (isOrderBelongsToUser['status'] == 'cancelled') {
                    return res.status(400).send({ status: false, message: `Unable to update or change the status, because it's already in cancelled status.` })
                }
            }
        }
        //for cancellable : false
        if (isOrderBelongsToUser['status'] == "completed") {
            if (status) {
                return res.status(400).send({ status: true, message: `Cannot update or change the status, because it's already in completed status.` })
            }
        }

        if (isOrderBelongsToUser['status'] == "cancelled") {
            if (status) {
                return res.status(400).send({ status: true, message: `Cannot update or change the status, because it's already in cancelled status.` })
            }
        }

        if (isOrderBelongsToUser['status'] == "pending") {
            if (status) {
                if (["completed", "pending"].indexOf(status) === -1) {
                    return res.status(400).send({status: false,message: `Unable to update status due to Non-cancellation policy.`})
                }

                const updatedOrderDetails = await orderModel.findOneAndUpdate({ _id: orderId }, { $set: { status: status } }, { new: true })

                return res.status(200).send({ status: true, message: `Successfully updated the order details.`, data: updatedOrderDetails })
            }
        }

    } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
    }
}


module.exports = {createOrder,updateOrder};