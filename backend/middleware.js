const jwt = require("jsonwebtoken");
function authRequired(req,res,next) {
 const h=req.headers.authorization||"", token=h.startsWith("Bearer ")?h.slice(7):"";
 if(!token) return res.status(401).json({success:false,message:"Please log in first."});
 try { req.user=jwt.verify(token,process.env.JWT_SECRET||"change-this-dev-secret"); next(); }
 catch { return res.status(401).json({success:false,message:"Session expired. Please log in again."}); }
}
function adminRequired(req,res,next) {
 if(req.user?.role!=="admin") return res.status(403).json({success:false,message:"Developer admin access required."});
 next();
}
module.exports={authRequired,adminRequired};
