import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter your business or full name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please enter an email address"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please enter a password"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    phone: {
      type: String,
      required: [true, "Please enter a phone number"],
      trim: true,
    },
    role: {
      type: String,
      default: "seller",
    },
    isApproved: {
      type: Boolean,
      default: false, // ඇඩ්මින් විසින් අනුමත කරන තෙක් offline/pending තැබීමට
    },
    shopName: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    }
  },
  { 
    timestamps: true // මෙමඟින් seller සෑදූ දිනය (createdAt) සහ update කළ දිනය (updatedAt) ස්වයංක්‍රීයව එකතු වේ.
  }
);

// දැනටමත් Model එකක් පවතී නම් එය භාවිතා කරයි, නැතහොත් අලුත් එකක් සාදයි
const Seller = mongoose.models.seller || mongoose.model("seller", sellerSchema);

export default Seller;