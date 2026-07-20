import Address from "../models/Address.js";



/**
 * ✅ SAVE/UPDATE ADDRESS (AUTH REQUIRED)
 * POST /api/address/add
 */
export const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressData = req.body;

    // 1. Basic validation (already good in your version)
    const requiredFields = ['firstName', 'lastName', 'email', 'street', 'city', 'state', 'zipcode', 'country', 'phone'];
    for (const field of requiredFields) {
      if (!addressData[field]) {
        return res.status(400).json({ success: false, message: `${field} is required` });
      }
    }

    // 2. UPSERT LOGIC: Find existing address for this user and update it, 
    // or create a new one if it doesn't exist (upsert: true)
    const address = await Address.findOneAndUpdate(
      { userId }, // Find by user ID
      { ...addressData, userId }, // Data to update
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Address saved successfully",
      address,
    });
  } catch (error) {
    console.error("Save Address Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
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

