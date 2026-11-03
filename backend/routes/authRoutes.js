const express=require("express"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken"), db=require("../db");
const router=express.Router();
const tokenFor=u=>jwt.sign({user_id:u.user_id,email:u.email,role:u.role,full_name:u.full_name},process.env.JWT_SECRET||"change-this-dev-secret",{expiresIn:"12h"});
router.post("/register",async(req,res,next)=>{try{
 const {full_name,email,password,department}=req.body||{};
 if(!full_name?.trim()||!email?.trim()||!password)return res.status(400).json({success:false,message:"Full name, email and password are required."});
 if(password.length<8)return res.status(400).json({success:false,message:"Password must be at least 8 characters."});
 const em=email.trim().toLowerCase(),[old]=await db.query("SELECT user_id FROM users WHERE email=? LIMIT 1",[em]);
 if(old.length)return res.status(409).json({success:false,message:"Email already registered. Please log in."});
 const hash=await bcrypt.hash(password,10);
 const [r]=await db.query("INSERT INTO users (full_name,email,password_hash,role,department) VALUES (?,?,?,'student',?)",[full_name.trim(),em,hash,department?.trim()||null]);
 const user={user_id:r.insertId,full_name:full_name.trim(),email:em,department:department?.trim()||null,role:"student"};
 res.status(201).json({success:true,message:"Registration successful.",user,token:tokenFor(user)});
}catch(e){next(e);}});
router.post("/login",async(req,res,next)=>{try{
 const {email,password}=req.body||{};
 if(!email?.trim()||!password)return res.status(400).json({success:false,message:"Email and password are required."});
 const [rows]=await db.query("SELECT user_id,full_name,email,password_hash,role,department,is_active FROM users WHERE email=? LIMIT 1",[email.trim().toLowerCase()]);
 if(!rows.length)return res.status(401).json({success:false,message:"Invalid email or password."});
 const u=rows[0]; if(u.is_active===0||u.is_active===false)return res.status(403).json({success:false,message:"Account inactive."});
 if(!u.password_hash||!String(u.password_hash).startsWith("$2"))return res.status(401).json({success:false,message:"No valid password hash for this account. Register or reset it."});
 if(!await bcrypt.compare(password,u.password_hash))return res.status(401).json({success:false,message:"Invalid email or password."});
 const user={user_id:u.user_id,full_name:u.full_name,email:u.email,role:u.role,department:u.department};
 res.json({success:true,message:"Login successful.",user,token:tokenFor(user)});
}catch(e){next(e);}});
module.exports=router;
