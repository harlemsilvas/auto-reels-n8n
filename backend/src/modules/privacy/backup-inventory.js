const path=require('node:path');
const {digest}=require('./restore-guard');
async function inventory(fs,root,now=new Date()) {
  const base=path.resolve(root),rootStat=await fs.lstat(base);
  if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||await fs.realpath(base)!==base)throw Error('UNSAFE_BACKUP_DIRECTORY');
  const rows=[];
  async function walk(directory,depth){
    if(depth>12)throw Error('BACKUP_INVENTORY_DEPTH_LIMIT');
    for(const name of (await fs.readdir(directory)).sort()){
      const file=path.join(directory,name),s=await fs.lstat(file),relative=path.relative(base,file);
      if(s.isSymbolicLink()){rows.push({pathHash:digest(relative),kind:'symlink',reviewRequired:true});continue;}
      if(s.isDirectory()){await walk(file,depth+1);continue;}
      if(!s.isFile()){rows.push({pathHash:digest(relative),kind:'special',reviewRequired:true});continue;}
      const database=/\.(dump|sql)(\.gz)?$/i.test(name);
      const archive=/\.(tar|tgz|zip|gz)(\.gz)?$/i.test(name);
      const kind=database?'database':archive?'archive':'other';
      const ageDays=Math.floor((now.getTime()-s.mtimeMs)/86400000);
      rows.push({pathHash:digest(relative),kind,sizeBytes:s.size,ageDays,
        retentionReview:ageDays>=30,reviewRequired:true});
    }
  }
  await walk(base,0);
  return {version:1,observedAt:now.toISOString(),files:rows,automaticDeletion:false,
    limitation:'mtime is not verified creation time; inventory is local, non-atomic and does not cover external copies'};
}
module.exports={inventory};
