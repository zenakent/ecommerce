let mongoose = require("mongoose");

//====================================================
// Schema 
//====================================================

let productSchema = new mongoose.Schema({
    name: String,
    image: String,
    imageId: String,
    brand: String,
    quantity: Number,
    price: Number,
    description: String,
    totalSold: {
        type: Number,
        default: 0,
    },
    type: String,
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review"
        }
        ],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);