const express=require("express"),multer=require("multer"),path=require("path"),db=require("../db");
const {authRequired,adminRequired}=require("../middleware"),router=express.Router();
const upload=multer({storage:multer.diskStorage({destination:(_q,_f,cb)=>cb(null,path.join(__dirname,"..","uploads")),filename:(_q,f,cb)=>cb(null,Date.now()+"-"+Math.round(Math.random()*1e9)+path.extname(f.originalname).toLowerCase())}),limits:{fileSize:5*1024*1024},fileFilter:(_q,f,cb)=>cb(null,["image/jpeg","image/png","image/webp"].includes(f.mimetype))});
router.get("/",async(req,res,next)=>{try{
 let sql="SELECT i.item_id,i.user_id,i.category_id,i.item_name,i.description,i.item_type,i.location,i.item_date,i.image_path,i.status,i.created_at,c.category_name FROM items i LEFT JOIN categories c ON c.category_id=i.category_id WHERE 1=1",a=[];
 const {search="",type="",category_id="",location=""}=req.query;
 if(search){sql+=" AND (i.item_name LIKE ? OR i.description LIKE ?)";a.push("%"+search+"%","%"+search+"%");}
 if(["lost","found"].includes(type)){sql+=" AND i.item_type=?";a.push(type);}
 if(category_id){sql+=" AND i.category_id=?";a.push(category_id);}
 if(location){sql+=" AND i.location LIKE ?";a.push("%"+location+"%");}
 sql+=" ORDER BY i.created_at DESC";const [data]=await db.query(sql,a);res.json({success:true,data});
}catch(e){next(e);}});
router.get("/:id",async(req,res,next)=>{try{const [r]=await db.query("SELECT i.*,c.category_name FROM items i LEFT JOIN categories c ON c.category_id=i.category_id WHERE i.item_id=?",[req.params.id]);if(!r.length)return res.status(404).json({success:false,message:"Item not found."});res.json({success:true,data:r[0]});}catch(e){next(e);}});
router.post("/",authRequired,upload.single("image"),async(req,res,next)=>{try{
 const {category_id,item_name,description,item_type,location,item_date}=req.body;
 if(!item_name?.trim()||!description?.trim()||!["lost","found"].includes(item_type)||!location?.trim()||!item_date)return res.status(400).json({success:false,message:"Item name, description, valid type, location and date are required."});
 const image=req.file?"/uploads/"+req.file.filename:null;
 const [r]=await db.query("INSERT INTO items (user_id,category_id,item_name,description,item_type,location,item_date,image_path,status) VALUES (?,?,?,?,?,?,?,?, 'open')",[req.user.user_id,category_id||null,item_name.trim(),description.trim(),item_type,location.trim(),item_date,image]);
 const [data]=await db.query("SELECT i.*,c.category_name FROM items i LEFT JOIN categories c ON c.category_id=i.category_id WHERE i.item_id=?",[r.insertId]);
 res.status(201).json({success:true,message:"Item reported.",data:data[0]});
}catch(e){next(e);}});
router.patch("/:id/status",authRequired,async(req,res,next)=>{try{
 const {status}=req.body;if(!["open","claimed","returned","closed","rejected"].includes(status))return res.status(400).json({success:false,message:"Invalid status."});
 const [r]=await db.query("SELECT user_id FROM items WHERE item_id=?",[req.params.id]);if(!r.length)return res.status(404).json({success:false,message:"Item not found."});
 if(r[0].user_id!==req.user.user_id&&req.user.role!=="admin")return res.status(403).json({success:false,message:"Not allowed."});
 await db.query("UPDATE items SET status=? WHERE item_id=?",[status,req.params.id]);res.json({success:true,message:"Status updated."});
}catch(e){next(e);}});
router.delete("/:id",authRequired,adminRequired,async(req,res,next)=>{try{const [r]=await db.query("DELETE FROM items WHERE item_id=?",[req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:"Item not found."});res.json({success:true,message:"Item deleted."});}catch(e){next(e);}});
module.exports=router;
