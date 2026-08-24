import mongoose from "mongoose";
import fs from "fs";
const env = fs.readFileSync(".env","utf8");
const uri = (env.match(/MONGODB_URI="?([^"\n]+)"?/)||[])[1];
await mongoose.connect(uri);
const Cat = mongoose.connection.collection("categories");
const cats = await Cat.find({}, {projection:{name:1,parent:1,parentId:1,children:1,level:1}}).toArray();
console.log("total categories:", cats.length);
// how many named "Apple"
const apples = cats.filter(c=>c.name==="Apple");
console.log("nodes named Apple:", apples.length, apples.map(a=>String(a._id)));
// show shape of one doc
console.log("sample keys:", Object.keys(cats[0]||{}));
console.log("sample:", JSON.stringify(cats.slice(0,3).map(c=>({_id:String(c._id),name:c.name,parent:c.parent&&String(c.parent),parentId:c.parentId&&String(c.parentId),children:c.children&&c.children.length,level:c.level}))));
// find ...ccb1
const target = cats.find(c=>String(c._id)==="6a33891e2945ecb6c968ccb1");
console.log("AirPods categoryId node:", target?{_id:String(target._id),name:target.name,parent:target.parent&&String(target.parent),parentId:target.parentId&&String(target.parentId)}:"NOT FOUND in categories collection");
await mongoose.disconnect();
