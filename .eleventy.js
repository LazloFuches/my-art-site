module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  
  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};