import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Seller from '../models/sellerModel.js'; // ඔබ ලබාදුන් Seller Model එක

// ---------------- REGISTER SELLER ----------------
export const sellerRegister = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.json({ success: false, message: "Missing Required Fields" });
    }

    // දැනටමත් මෙම Email එකෙන් ගිණුමක් පවතීදැයි පරීක්ෂා කිරීම
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.json({ success: false, message: "Seller already exists with this email" });
    }

    // Password එක ආරක්ෂිතව Hash කිරීම
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // අලුත් Seller කෙනෙක් ඩේටාබේස් එකට ඇතුළත් කිරීම
    const newSeller = new Seller({
      name,
      email,
      password: hashedPassword,
      phone
    });
    
    const seller = await newSeller.save();

    // සාර්ථකව ලියාපදිංචි වූ පසු Token එකක් සෑදීම (Database ID එක සමඟ)
    const token = jwt.sign({ id: seller._id, email: seller.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Cookie එක සෙට් කිරීම
    res.cookie('sellerToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, message: "Seller Registered Successfully", token });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// ---------------- LOGIN SELLER ----------------
export const sellerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    let seller = null;

    // ---- Admin Seller ලෙස Login කිරීම ----
    if (password === process.env.SELLER_PASSWORD && email === process.env.SELLER_EMAIL) {
      // Admin Seller එක Database එකෙන් හොයන්න (නැතිනම් අලුත් එකක් හදන්න)
      seller = await Seller.findOne({ email });
      if (!seller) {
        // Admin Seller නැතිනම්, එය create කරන්න (මුල් පිහිටුවීම සඳහා)
        const hashedPassword = await bcrypt.hash(password, 10);
        seller = new Seller({
          name: "Admin Seller",
          email,
          password: hashedPassword,
          phone: "0000000000",
          role: "admin_seller",
          isApproved: true
        });
        await seller.save();
      }
    } else {
      // ---- සාමාන්‍ය Seller Login ----
      seller = await Seller.findOne({ email });
      if (!seller) {
        return res.json({ success: false, message: "Invalid Credentials" });
      }
      const isMatch = await bcrypt.compare(password, seller.password);
      if (!isMatch) {
        return res.json({ success: false, message: "Invalid Credentials" });
      }
    }

    // ✅ Token එකට Seller ID එක ඇතුළත් කරන්න
    const token = jwt.sign(
      { 
        id: seller._id,        // Frontend එක `id` හෝ `_id` ලෙස බලාපොරොත්තු වෙනවා
        email: seller.email,
        role: seller.role || "seller"
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Cookie Set කිරීම (අවශ්‍ය නම්)
    res.cookie('sellerToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ✅ Seller Data එක Response එකට ඇතුළත් කරන්න (password එක ඉවත් කරන්න)
    const sellerData = seller.toObject();
    delete sellerData.password;

    return res.json({
      success: true,
      message: "Logged In Successfully",
      token,
      seller: sellerData   // ✅ Frontend එකට මෙය අවශ්‍යයි
    });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};



// ---------------- IS SELLER AUTH ----------------
export const isSellerAuth = async (req, res) => {
  try {
    // ✅ req.sellerId හෝ req.seller._id භාවිතා කරන්න
    const sellerId = req.sellerId || req.seller?._id;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized - No seller ID' });
    }

    const seller = await Seller.findById(sellerId).select('-password');
    if (!seller) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Seller not found' });
    }
    
    res.json({ success: true, seller });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// ---------------- LOGOUT SELLER ----------------
export const sellerLogout = async (req, res) => {
  try {
    res.clearCookie('sellerToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    });
    return res.json({ success: true, message: "Logged Out" });
  } catch (error) { 
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};