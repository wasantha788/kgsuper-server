import mongoose from "mongoose";

const sellerRequestProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  weight: { type: String, required: true },
  quantity: { type: Number, required: true },
  sellerName: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  sellerPhone: { type: String, required: true },
  sellerAddress: { type: String, required: true },
  images: [
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    }
  ],
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
}, { timestamps: true });

// Explicitly naming the collection 'sellerrequests' to match your MongoDB collection
export default mongoose.model("sellerRequest", sellerRequestProductSchema, "sellerrequests");