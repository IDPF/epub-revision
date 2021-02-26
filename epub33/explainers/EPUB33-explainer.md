# EPUB 3.3 Explainer

**Written**: 2021-02-22, **Updated**: 2021-02-26

**EPUB 3.3** is a packaging mechanism for web content, designed for electronic books. 



Spec references:
* [EPUB 3.3 Overview](https://w3c.github.io/epub-specs/epub33/overview/), a non-normative overview of EPUB 3.3
* [EPUB 3.3 Core](https://w3c.github.io/epub-specs/epub33/core//), the specification of the file format
* [EPUB 3.3 Reading Systems](https://w3c.github.io/epub-specs/epub33/rs/), the specification for user agents, known as EPUB Reading Systems. 
* [EPUB Accessibility 1.1](https://w3c.github.io/epub-specs/epub33/a11y/)
* [EPUB Accessibility Techniques 1.1](https://w3c.github.io/epub-specs/epub33/a11y-tech/)




## Security and Privacy Questionnaire

EPUB files are presented to end users by EPUB Reading Systems, which can be constructed as web applications but are more likely to be native apps. The EPUB specifications define the file format in great detail, but generally give user agents wide latitude, subject mostly to the requirements of the embedded technologies, such as HTML, SVG, and CSS. 

This makes it hard to think about security issues. In order to read EPUB files, I generally have to give personally-identifying information like a credit card number to the ebook retailer. They have likely altered the original EPUB, for example by applying digital rights management to the constituent files. Most of the security implications around EPUB depend on the architectural details and the business model of the reading system. 

It's hard to even reason about how HTML's security issues affect EPUB. If I read an EPUB on the Google Play app on an Android tablet, what risks am I exposed to? Can any of those risks be mitigated by the design of the EPUB specification? 



### 1. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

EPUB Reading Systems typically collect information on the reading habits of their users. In some cases this information is necessary to provide a good user experience; in other cases the information is collected for other users--the reading system company or the publisher of the book. 

1. Tracking reading position. You really do want the reading system to remember that you just started chapter 5. 
2. Remembering highlights, notes, bookmarks. 
3. Remembering user preferences around fonts, visual themes (including dark/light), text justification, etc. 
4. Recording progress through a book and whether a book was finished. 
5. I am aware of some reading systems that track every reading system, including what tie of day, the duration, how many pages read, what book, IP address, etc. 



### 2. Is this specification exposing the minimum amount of information necessary to power the feature?

The EPUB specification does not mention reading system features like bookmarks or highlights. There is no requirement to remember reading state. 

### 3. How does this specification deal with personal information or personally-identifiable information or information derived thereof?

The EPUB specifications do not mention personal information.

### 4. How does this specification deal with sensitive information?

Merely the fact that you are reading a particular book can be sensitive information. Again, the specification offers no guidance to reading systems on this matter. 

### 5. Does this specification introduce new state for an origin that persists across browsing sessions?

Reading systems, in order to meet user expectations, must retain some information across browsing sessions, for example to remember reading location. The spec has a non-normative section saying that reading systems should treat each EPUB as a unique origin, but does not say anything about most reading system behaviors.

### 6. What information from the underlying platform, e.g. configuration data, is exposed by this specification to an origin?

Many EPUB reading systems do not support scripting at all. For those that do, scripts in EPUBs that seek this sort of information might be blocked by the application before they even reach the platform level. If not, the risks are likely similar to that of HTML/CSS. 


### 7. Does this specification allow an origin access to sensors on a user’s device?

EPUB does have requirements for user agents to respond to device orientation (`portrait | landscape`) for fixed-layout EPUBs. 

There has been talk about scripting EPUB based on geolocation information; I don't know if this has happened in the wild yet, or if any reading systems would allow access to this information. This would happen through existing Web APIs; EPUB does not specify new APIs to interact with sensors. 

### 8. What data does this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

??

### 9. Does this specification enable new script execution/loading mechanisms?

No. Scripting is not forbidden, but follows the HTML model.

### 10. Does this specification allow an origin to access other devices?

EPUB reading systems often implement syncing behaviour across multiple devices with the same user account. This is not required or mentioned by the spec. 

### 11. Does this specification allow an origin some measure of control over a user agent’s native UI?

Only to the extent that the reading system or app platform would allow full-screen, etc. 

### 12. What temporary identifiers might this this specification create or expose to the web?

None are mentioned in the specs.  

### 13. How does this specification distinguish between behavior in first-party and third-party contexts?

This scenario is something like an EPUB author including a script that places advertising in an EPUB? 

### 14. How does this specification work in the context of a user agent’s Private Browsing or "incognito" mode?

This seems a bit specific to browsers... 


### 15. Does this specification have a "Security Considerations" and "Privacy Considerations" section?

Yes, but it feels quite inadequate. 

### 16. Does this specification allow downgrading default security characteristics?

No.

### 17. What should this questionnaire have asked?

I am somewhat concerned about a feature of app platform web views that could lead to user confusion. In testing, if an EPUB reading system opens an EPUB that contains a non-HTML content document, the RS will often offer to the user the opportunity to download the file. This is a spec violation, but I've seen this behaviour in multiple user agents. It seems to be browser-level issue: request a `.dmg` file, for example, and you get a download dialogue. 











