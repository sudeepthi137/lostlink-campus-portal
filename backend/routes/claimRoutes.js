const express=require("express"),db=require("../db"),{authRequired,adminRequired}=require("../middleware"),router=express.Router();
router.get("/",authRequired,async(req,res,next)=>{try{
 let sql="SELECT cl.claim_id,cl.item_id,cl.claimant_id,cl.proof_details,cl.status,cl.created_at,i.item_name,i.item_type,i.user_id owner_id,u.full_name claimant_name FROM claims cl JOIN items i ON i.item_id=cl.item_id JOIN users u ON u.user_id=cl.claimant_id",a=[];
 if(req.user.role!=="admin"){sql+=" WHERE cl.claimant_id=? OR i.user_id=?";a=[req.user.user_id,req.user.user_id];}
 sql+=" ORDER BY cl.created_at DESC";const [data]=await db.query(sql,a);res.json({success:true,data});
}catch(e){next(e);}});
router.post("/",authRequired,async(req,res,next)=>{try{
 const {item_id,proof_details}=req.body||{};if(!item_id||!proof_details?.trim())return res.status(400).json({success:false,message:"Item ID and proof details are required."});
 const [items]=await db.query("SELECT item_id,user_id,status FROM items WHERE item_id=?",[item_id]);if(!items.length)return res.status(404).json({success:false,message:"Item not found."});
 if(items[0].user_id===req.user.user_id)return res.status(400).json({success:false,message:"You cannot claim your own item."});
 if(items[0].status!=="open")return res.status(409).json({success:false,message:"Item is not open for claims."});
 const [dup]=await db.query("SELECT claim_id FROM claims WHERE item_id=? AND claimant_id=? AND status IN ('pending','approved')",[item_id,req.user.user_id]);if(dup.length)return res.status(409).json({success:false,message:"You already have an active claim."});
 const [r]=await db.query("INSERT INTO claims (item_id,claimant_id,proof_details,status) VALUES (?,?,?,'pending')",[item_id,req.user.user_id,proof_details.trim()]);
 res.status(201).json({success:true,message:"Claim submitted.",data:{claim_id:r.insertId,item_id:Number(item_id),status:"pending"}});
}catch(e){next(e);}});
router.patch("/:id/status",authRequired,adminRequired,async(req,res,next)=>{try{
 const {status}=req.body;if(!["pending","approved","rejected","completed"].includes(status))return res.status(400).json({success:false,message:"Invalid claim status."});
 const [r]=await db.query("UPDATE claims SET status=? WHERE claim_id=?",[status,req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:"Claim not found."});
 if(status==="approved"){const [c]=await db.query("SELECT item_id FROM claims WHERE claim_id=?",[req.params.id]);if(c.length)await db.query("UPDATE items SET status='claimed' WHERE item_id=?",[c[0].item_id]);}
 res.json({success:true,message:"Claim status updated."});
}catch(e){next(e);}});
module.exports=router;
