var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");
var validator = require('validator');
var bcrypt = require("bcrypt");
require('mongoose-type-email');

var UserSchema = new mongoose.Schema({
    email: {
        type: String, 
        
        validate: [validator.isEmail, 'invalid email'],
    },
    password: {
        type: String, 
    },
    firstName: {
        type: String, 
        
    },
    lastName: {
        type: String, 
        
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isSuperAdmin: {
        type: Boolean,
        default: false
    },
    notifications: [
    	{
    	   type: mongoose.Schema.Types.ObjectId,
    	   ref: 'Notification'
    	}
    ],
    cart: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActivated: {
        type: Boolean,
        default: false
    },
    facebook: {
        id: String,
        token: String,
        email: String,
        firstName: String,
        lastName: String,
    },
    shippingAddress: [
        {
            fullName: String,
            address: String,
            contactNumber: Number,
            defaultAddress: {
                type: Boolean,
                default: false,
            }
        }
        ],
    resetPasswordToken: String,
    emailToken: String,
    resetPasswordExpires: Date,
});

UserSchema.methods.encyrptPassword = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSalt(8), null);
};

UserSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.password);  
};

UserSchema.plugin(passportLocalMongoose , { usernameField : 'email' });

module.exports = mongoose.model("Users", UserSchema);