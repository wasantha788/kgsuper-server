import Address from "../models/Address.js";

/**
 * ✅ ADD ADDRESS (AUTH REQUIRED)
 * POST /api/address/add
 */
export const addAddress = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ from JWT cookie

    const {
      firstName,
      lastName,
      email,
      street,
      city,
      state,
      zipcode,
      country,
      phone,
    } = req.body;

    // 🔐 Validate required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !street ||
      !city ||
      !state ||
      !zipcode ||
      !country ||
      !phone
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ✅ Create address
    const address = await Address.create({
      userId,
      firstName,
      lastName,
      email,
      street,
      city,
      state,
      zipcode,
      country,
      phone,
    });

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      address,
    });
  } catch (error) {
    console.error("Add Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
    });
  }
};

/**
 * ✅ GET USER ADDRESSES (AUTH REQUIRED)
 * GET /api/address/get
 */
export const getAddress = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ from JWT cookie

    const addresses = await Address.find({ userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      addresses,
    });
  } catch (error) {
    console.error("Get Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
};

/**
 * ✅ DELETE ADDRESS (AUTH REQUIRED)
 * DELETE /api/address/:id
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await address.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};
