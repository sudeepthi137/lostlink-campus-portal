const express=require("express"),db=require("../db"),router=express.Router();
router.get("/",async(_req,res,next)=>{try{const [data]=await db.query("SELECT category_id,category_name FROM categories ORDER BY category_name");res.json({success:true,data});}catch(e){next(e);}});
module.exports=router;
